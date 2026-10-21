"use client";

import { useEffect, useState } from "react";
import { Check, FileSearch, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flag, SeverityFlag, StatusFlag } from "@/components/shared/badges";
import { sourceLabel } from "@/components/shared/SourceChip";
import { api } from "@/lib/api";
import { PackAudit, PackFix, PackInspection, SourceRef } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

/** Word-level difference between two texts (longest common subsequence), for showing a suggested fix. */
function wordDiff(a: string, b: string): { text: string; kind: "same" | "del" | "add" }[] {
  const x = a.split(/(\s+)/), y = b.split(/(\s+)/);
  const m = x.length, n = y.length;
  const L: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: { text: string; kind: "same" | "del" | "add" }[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (x[i] === y[j]) out.push({ text: x[i++], kind: "same" }), j++;
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ text: x[i++], kind: "del" });
    else out.push({ text: y[j++], kind: "add" });
  }
  while (i < m) out.push({ text: x[i++], kind: "del" });
  while (j < n) out.push({ text: y[j++], kind: "add" });
  return out;
}

const VERDICT: Record<PackAudit["verdict"], { text: string; tone: "ok" | "stop" | "review" | "muted" }> = {
  compliant: { text: "Meets the rule", tone: "ok" },
  issue: { text: "Does not meet it", tone: "stop" },
  unclear: { text: "Unclear", tone: "review" },
  no_rule: { text: "No rule applies", tone: "muted" },
};

/** Talk to the Pack: one element of the artwork, what governs it, and what the AI says about it. */
export function PackInspectorCard({ fieldKey, onClose }: { fieldKey: string; onClose: () => void }) {
  const { sessionId, view, run, busy, setHighlight } = useBriefStore();
  const [info, setInfo] = useState<PackInspection | null>(null);
  const [audit, setAudit] = useState<PackAudit | null>(null);
  const [fix, setFix] = useState<PackFix | null>(null);
  const [working, setWorking] = useState<"audit" | "fix" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const version = view?.state.updated_at;
  const finalized = view?.state.status === "finalized";

  useEffect(() => {
    if (!sessionId) return;
    let current = true;
    setError(null);
    api
      .inspectField(sessionId, fieldKey)
      .then((i) => current && setInfo(i))
      .catch((e) => current && setError(e instanceof Error ? e.message : "Could not load this element."));
    return () => {
      current = false;
    };
  }, [sessionId, fieldKey, version]);

  // A different element starts fresh.
  useEffect(() => {
    setAudit(null);
    setFix(null);
    setShowSources(false);
  }, [fieldKey]);

  if (!sessionId) return null;

  const call = async (what: "audit" | "fix") => {
    setWorking(what);
    setError(null);
    try {
      if (what === "audit") setAudit(await api.auditField(sessionId, fieldKey));
      else setFix(await api.suggestFix(sessionId, fieldKey));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed.");
    } finally {
      setWorking(null);
    }
  };
  const apply = async () => {
    if (!fix?.suggested || !fix.source) return;
    const ok = await run(
      "Applying the fix and re-checking",
      (sid) => api.applyFix(sid, fieldKey, fix.suggested!, fix.source!, fix.reason ?? undefined),
      "Fix applied · logged in the change log"
    );
    if (ok) setFix(null);
  };
  const locate = (s: SourceRef) => {
    if (s.bbox) setHighlight({ label: info?.label ?? fieldKey, sources: [s] });
  };

  return (
    <section aria-labelledby="pack-h" className="ticket anim-rise p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="meta text-ink-muted">Talk to the Pack</p>
          <h3 id="pack-h" className="text-[16px] font-bold text-ink">{info?.label ?? "Loading…"}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {info && <StatusFlag status={info.status} />}
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded hover:bg-ink/5" aria-label="Close the inspector">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-2 rounded border border-stop/40 bg-stop-soft px-3 py-2 text-[13px]">{error}</p>}
      {!info && !error && <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Reading…</p>}

      {info && (
        <div className="mt-2 space-y-3 text-[13px]">
          <p className="break-words rounded bg-ground px-3 py-2 text-ink">{info.value ?? <i className="text-ink-faint">No value</i>}</p>
          <p className="text-xs text-ink-muted">
            From: {info.sources.length ? Array.from(new Set(info.sources.map(sourceLabel))).join(", ") : "no source yet"}
          </p>

          {info.issues.length > 0 && (
            <ul className="space-y-1.5">
              {info.issues.map((i) => (
                <li key={i.id} className="rounded border border-line px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink">{i.title}</p>
                    <SeverityFlag severity={i.severity} className="-mr-3 shrink-0" />
                  </div>
                  {i.clauses.map((c) => (
                    <p key={c.id} className="mt-0.5 font-mono text-[10px] text-ink-faint">{c.id}</p>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {info.clauses.length > 0 ? (
            <div className="space-y-1">
              {info.clauses.slice(0, 2).map((c) => (
                <p key={c.id} className="text-xs text-ink-2">
                  <span className="font-mono text-[10px] text-ink-faint">{c.id}</span> {c.text}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-muted">No rule in the loaded rule packs governs this element.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => call("audit")} disabled={!!working}>
              {working === "audit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Audit this element
            </Button>
            <Button variant="outline" size="sm" onClick={() => call("fix")} disabled={!!working || finalized}>
              {working === "fix" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Suggest fix
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSources((v) => !v)} aria-expanded={showSources}>
              <FileSearch className="h-3.5 w-3.5" /> Trace source
            </Button>
          </div>

          {audit && (
            <div className="space-y-2 rounded border border-line p-3" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                <Flag tone={VERDICT[audit.verdict].tone} side="right" className="-ml-3">{VERDICT[audit.verdict].text}</Flag>
                <span className="meta text-ink-faint">{audit.ai ? `AI audit · ${audit.model}` : "Code only (AI unavailable or not needed)"}</span>
              </div>
              <p className="text-ink">{audit.answer}</p>
              {audit.quotes.map((q) => (
                <blockquote key={q.clause_id} className="border-l-[3px] border-rail pl-3 text-xs text-ink-2">
                  “{q.text}”
                  <footer className="mt-0.5 font-mono text-[10px] text-ink-faint">
                    {q.clause_id} · {q.standard}{q.exact ? "" : " · rule text (no exact quote from the AI)"}
                  </footer>
                </blockquote>
              ))}
            </div>
          )}

          {fix && (
            <div className="space-y-2 rounded border border-line p-3" aria-live="polite">
              {fix.suggested ? (
                <>
                  <p className="meta text-ink-faint">
                    {fix.source === "code" ? "Calculated by code from your files" : `Suggested by AI · ${fix.model}`} · nothing changes until you apply it
                  </p>
                  <p className="break-words leading-relaxed">
                    {wordDiff(fix.current ?? "", fix.suggested).map((w, i) => (
                      <span
                        key={i}
                        className={cn(w.kind === "del" && "bg-stop-soft text-stop-deep line-through", w.kind === "add" && "bg-ok-soft font-semibold text-ok-deep")}
                      >
                        {w.text}
                      </span>
                    ))}
                  </p>
                  {fix.reason && <p className="text-xs text-ink-muted">{fix.reason}</p>}
                  {fix.impact && (
                    <p className="text-xs text-ink-2">
                      {fix.impact.resolved.length ? <span className="text-ok-deep">Fixes {fix.impact.resolved.length}: {fix.impact.resolved.slice(0, 2).join("; ")}. </span> : null}
                      {fix.impact.introduced.length ? <span className="text-stop-deep">New: {fix.impact.introduced.slice(0, 2).join("; ")}. </span> : null}
                      Readiness {fix.impact.readiness_before}% → {fix.impact.readiness_after}%.
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setFix(null)}>Cancel</Button>
                    <Button size="sm" onClick={apply} disabled={!!busy || finalized}>
                      <Check className="h-3.5 w-3.5" /> Apply
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-ink-2">{fix.message}</p>
              )}
            </div>
          )}

          {showSources && (
            <ul className="space-y-1.5" aria-label="Where the value came from">
              {[...info.sources, ...info.candidates.filter((c) => !info.sources.some((s) => s.file === c.file && s.cell === c.cell && s.snippet === c.snippet))].map((s, i) => (
                <li key={i} className="rounded bg-ground px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase text-ink-muted">{sourceLabel(s)}</span>
                    {s.bbox && (
                      <button onClick={() => locate(s)} className="text-[11px] font-semibold text-rail underline">Show on the artwork</button>
                    )}
                  </div>
                  <p className="mt-0.5 break-words text-ink">“{s.snippet}”</p>
                  {s.note && <p className="mt-0.5 text-ink-muted">Note: {s.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
