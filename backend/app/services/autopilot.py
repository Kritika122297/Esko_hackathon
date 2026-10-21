"""Brief Autopilot: the build pipeline with each stage recorded in the trace (see app/services/trace.py).

The stages are the real ones (read, extract, reconcile, check, AI review, route questions); the messages carry
the counts those stages produced, and the durations are measured.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import List, Tuple

from app.models.brief import BriefState
from app.models.extraction import Extraction
from app.services import trace
from app.services.ai_assist import run_ai
from app.services.checks import CheckContext
from app.services.checks.base import src_label
from app.services.merge import group_candidates
from app.services.pipeline import analyze, read_files, recompute
from app.services.values import plural


def build(state: BriefState, paths: List[Path], session_dir: Path) -> Tuple[CheckContext, Extraction]:
    with trace.timed("read", "File reader", f"Reading {plural(len(paths), 'file')}") as t:
        ex = read_files([(p, p.name) for p in paths], session_dir)
        t.done("ok", f"Read {plural(len(paths), 'file')}: {plural(len(ex.pages), 'page')}, "
                     f"{plural(len(ex.fragments), 'text fragment')}, {plural(len(ex.panels), 'dieline panel')}",
               detail="; ".join(ex.notes[:6]) or None)
    if ex.panels:
        front = next((p for p in ex.panels if p.is_main), None)
        trace.event("read", "Dieline", "ok" if front else "warning",
                    f"Found {plural(len(ex.panels), 'panel')}; front panel (PDP): {front.label if front else 'not identified'}")

    with trace.timed("extract", "Field extraction", "Filling the brief from the files") as t:
        ctx = analyze(state, ex)
        filled = [f for f in state.fields if f.value]
        by_source = Counter(s.kind for f in filled for s in f.sources[:1])
        t.done("ok", f"Filled {len(filled)} of {len(state.fields)} brief fields "
                     f"({', '.join(f'{n} from {k}' for k, n in by_source.most_common())})")

    with trace.timed("reconcile", "Reconciliation", "Comparing the files field by field") as t:
        multi, conflicts = 0, []
        for f in state.fields:
            groups = group_candidates(f.key, [c for c in f.candidates if c.source.kind != "ai"])
            if len({c.source.kind for c in f.candidates if c.source.kind != "ai"}) >= 2:
                multi += 1
            if len(groups) >= 2:
                conflicts.append(f"{f.label}: " + " vs ".join(f"{src_label(g[0].source)} '{g[0].value[:40]}'" for g in groups[:3]))
        t.done("warning" if conflicts else "ok",
               f"Compared {plural(multi, 'field')} found in more than one file; "
               + (f"{len(conflicts)} disagree" if conflicts else "they all agree"),
               detail="; ".join(conflicts[:8]) or None)

    with trace.timed("checks", "Rule checks", "Running the label checks") as t:
        recompute(state, ctx)  # each check function adds its own trace event
        issues = [i for i in state.issues if i.state == "open"]
        blocking = sum(1 for i in issues if i.severity == "blocking" and i.resolution == "data")
        t.done("warning" if blocking else "ok",
               f"{plural(len(state.passed_checks), 'check')} passed, {plural(len(issues), 'finding')} "
               f"({blocking} blocking)")

    with trace.timed("ai", "AI review", "Asking the AI to read the artwork and review claims") as t:
        run_ai(state, ctx, ex, session_dir)
        used, notes = state.ai.used_for, state.ai.notes
        failed = [n for n in notes if "did not run" in n or "switched off" in n]
        if not state.ai.enabled and not used:
            t.done("info", "AI is switched off; the brief rests on code checks only", detail="; ".join(notes) or None)
        else:
            t.done("warning" if failed else "ok",
                   f"{plural(len(used), 'AI step')} ran" + (f", {len(failed)} did not" if failed else "")
                   + "; every AI point was validated by code",
                   detail="; ".join(used + notes) or None)

    with trace.timed("route", "Question routing", "Routing questions to their owners") as t:
        qs = state.questions
        owners = Counter(q.owner for q in qs)
        must = Counter(q.owner for q in qs if q.priority == "must_answer")
        t.done("warning" if must else "ok",
               f"Routed {plural(len(qs), 'question')}" + (": " + ", ".join(
                   f"{o} {n}" + (f" ({must[o]} blocking)" if must[o] else "") for o, n in owners.most_common()) if qs else ""))
    return ctx, ex
