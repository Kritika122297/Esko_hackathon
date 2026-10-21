"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Check, ChevronDown, History, Loader2, Pencil, Radar, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Absence, BriefField, FieldStatus, ImpactPreview, Origin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";
import { StatusFlag } from "@/components/shared/badges";
import { SourceLine, sourceLabel } from "@/components/shared/SourceChip";
import { ImpactPanel } from "./ImpactPanel";

const SECTION_ORDER = ["Product", "Legal & Identity", "Ingredients & Allergens", "Claims & Certifications", "Quantity", "Nutrition", "Other Pack Copy", "Project"];
type Filter = "needs_review" | "missing" | "confirmed" | "all";

export function BriefEditor({ fields }: { fields: BriefField[] }) {
  const relevant = useMemo(() => fields.filter((f) => f.value || f.mandatory || f.not_applicable), [fields]);
  const counts = useMemo(
    () => ({
      needs_review: relevant.filter((f) => f.status === "needs_review").length,
      missing: relevant.filter((f) => f.status === "missing").length,
      confirmed: relevant.filter((f) => f.status === "confirmed").length,
      all: relevant.length,
    }),
    [relevant]
  );
  const [filter, setFilter] = useState<Filter>(counts.needs_review ? "needs_review" : "all");
  const shown = relevant.filter((f) => filter === "all" || f.status === filter);
  const sections = SECTION_ORDER.map((s) => ({ name: s, fields: shown.filter((f) => f.section === s) })).filter((s) => s.fields.length);
  const tabs: [Filter, string][] = [
    ["needs_review", "Needs review"],
    ["missing", "Missing"],
    ["confirmed", "Confirmed"],
    ["all", "All"],
  ];

  return (
    <section aria-labelledby="brief-fields-h" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="brief-fields-h" className="text-label font-bold uppercase text-ink">
          Brief fields
        </h2>
        <div role="tablist" aria-label="Filter fields" className="flex flex-wrap gap-1">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={cn(
                "h-8 rounded border px-2.5 text-xs font-semibold transition-colors duration-150",
                filter === k ? "border-ink bg-ink text-white" : "border-line text-ink-muted hover:border-ink-faint hover:text-ink"
              )}
            >
              {label} <b className="figure ml-0.5 text-[15px]">{counts[k]}</b>
            </button>
          ))}
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="ticket mt-4 p-6 text-center">
          <p className="font-semibold text-ink">{filter === "missing" ? "Nothing is missing." : "Nothing in this view."}</p>
          <p className="mt-1 text-xs text-ink-muted">Switch the filter to see other fields.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-6">
          {sections.map((s) => (
            <div key={s.name}>
              <div className="section-rule mb-2.5">
                <h3 className="text-[16px] font-bold text-ink">{s.name}</h3>
                <span className="text-xs text-ink-muted">
                  {s.fields.filter((f) => f.status !== "confirmed").length
                    ? `${s.fields.filter((f) => f.status !== "confirmed").length} to resolve`
                    : "all confirmed"}
                </span>
              </div>
              <div className="space-y-2">
                {s.fields.map((f) => (
                  <Ticket key={f.key} f={f} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const ABSENCE_TEXT: Record<Absence, string> = {
  not_provided: "Not provided in any file",
  not_detected: "Looked for on the artwork, not detected",
  not_applicable: "Marked not applicable",
};
const ORIGIN_TEXT: Record<Origin, string> = { human: "Person", rule: "Code rule", ai: "AI suggestion", source: "Source file" };

const FIGURE_RE = /^\s*(\d+(?:\.\d+)?)\s*(mcg|mg|g|kg|oz|%|kcal)?\s*$/i;

function Figure({ value, big }: { value: string; big: boolean }) {
  const m = value.match(FIGURE_RE);
  if (!m) return null;
  return (
    <span className={cn("figure inline-flex items-start whitespace-nowrap pt-1 text-ink", big ? "text-[56px]" : "text-[40px]")}>
      {m[1]}
      {m[2] && <span className={cn("ml-0.5 mt-0.5 font-bold leading-none [font-stretch:75%]", big ? "text-[22px]" : "text-[17px]")}>{m[2]}</span>}
    </span>
  );
}

/** Re-print animation key: changes only after mount, when the value or state actually changes. */
function usePrintKey(value: string | null, status: FieldStatus) {
  const first = useRef(true);
  const [n, setN] = useState(0);
  const sig = `${value}|${status}`;
  const prev = useRef(sig);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (prev.current !== sig) {
      prev.current = sig;
      setN((x) => x + 1);
    }
  }, [sig]);
  return n;
}

function Ticket({ f }: { f: BriefField }) {
  const { run, setHighlight, highlight, view, busy } = useBriefStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(f.value ?? "");
  const [impact, setImpact] = useState<ImpactPreview | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const printKey = usePrintKey(f.value, f.status);
  const finalized = view?.state.status === "finalized";
  const sid = view?.state.session_id ?? "";
  const located = [...f.sources, ...f.candidates.map((c) => c.source)].filter((s) => s.bbox);
  const selected = highlight?.label === f.label;
  const norm = (v: string | null) => (v ?? "").toLowerCase().replace(/[^a-z0-9%]/g, "");
  const alternatives = f.candidates.filter(
    (c, i, all) => norm(c.value) !== norm(f.value) && all.findIndex((x) => norm(x.value) === norm(c.value)) === i
  );
  const isFigure = Boolean(f.value && FIGURE_RE.test(f.value));
  const long = (f.value ?? "").length > 70;
  const extra = f.notes.length + f.history.length;

  const preview = async () => {
    setLoadingImpact(true);
    try {
      setImpact(await api.impact(sid, f.key, draft));
    } catch {
      setImpact(null);
    } finally {
      setLoadingImpact(false);
    }
  };
  const save = async (value: string, reason: string) => {
    const ok = await run("Saving and re-checking", (s) => api.editField(s, f.key, value, reason), "Saved · checks re-run");
    if (ok) {
      setEditing(false);
      setImpact(null);
    }
  };

  const markNA = () => {
    const reason = window.prompt(`Why does "${f.label}" not apply to this product?`);
    if (reason && reason.trim()) run("Saving", (s) => api.markNotApplicable(s, f.key, reason.trim()), "Marked not applicable");
  };

  const actions = !finalized && !editing && (
    <div className="flex flex-wrap items-center gap-2">
      {f.history.length > 0 && (
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("Undoing", (s) => api.undoField(s, f.key), "Last change undone")}>
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </Button>
      )}
      {!f.value && !f.not_applicable && (
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={markNA}>
          <Ban className="h-3.5 w-3.5" /> Not applicable
        </Button>
      )}
      {f.status !== "confirmed" && f.value && (
        <Button size="sm" disabled={!!busy} onClick={() => run("Confirming", (s) => api.confirmField(s, f.key), "Confirmed")}>
          <Check className="h-3.5 w-3.5" /> Confirm
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => { setDraft(f.value ?? ""); setEditing(true); }}>
        <Pencil className="h-3.5 w-3.5" /> {f.value ? "Edit" : "Add value"}
      </Button>
    </div>
  );

  return (
    <article
      aria-label={f.label}
      className={cn(
        "ticket",
        selected && "border-ink shadow-[inset_0_0_0_1px_#121514]",
        !selected && located.length > 0 && "hover:border-line-strong"
      )}
      onClick={() => located.length && !editing && setHighlight({ label: f.label, sources: located })}
    >
      <div key={`flag-${printKey}`} className={cn("absolute -right-px top-3", printKey > 0 && "anim-flag")}>
        <StatusFlag status={f.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-4 pr-24 pt-3">
        <h4 className="text-label font-bold uppercase text-ink">{f.label}</h4>
        {f.mandatory && <span className="text-[10px] uppercase tracking-wider text-ink-faint">Required</span>}
        {f.user_confirmed && <span className="text-[10px] uppercase tracking-wider text-rail">Reviewer-approved</span>}
      </div>

      <div key={`val-${printKey}`} className={cn(printKey > 0 && "anim-print")}>
        {editing ? (
          <div className="space-y-2 px-4 pb-3 pt-2" onClick={(e) => e.stopPropagation()}>
            <label className="sr-only" htmlFor={`edit-${f.key}`}>
              New value for {f.label}
            </label>
            {long ? (
              <textarea id={`edit-${f.key}`} value={draft} onChange={(e) => { setDraft(e.target.value); setImpact(null); }} rows={4} className="w-full rounded border border-line-strong bg-stock p-2 text-sm focus:border-ink" />
            ) : (
              <input id={`edit-${f.key}`} value={draft} onChange={(e) => { setDraft(e.target.value); setImpact(null); }} className="h-9 w-full rounded border border-line-strong bg-stock px-2 text-sm focus:border-ink" autoFocus />
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={preview} disabled={loadingImpact || !draft.trim()}>
                {loadingImpact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />} Preview impact
              </Button>
              <Button size="sm" disabled={!!busy || !draft.trim()} onClick={() => save(draft, "Edited in review")}>
                <Check className="h-3.5 w-3.5" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setImpact(null); setDraft(f.value ?? ""); }} aria-label="Cancel edit">
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
            {impact && <ImpactPanel p={impact} />}
          </div>
        ) : isFigure ? (
          <div className="grid grid-cols-[1fr_auto] items-end gap-4 px-4 pb-3 pt-1">
            <div className="min-w-0 space-y-2" onClick={(e) => e.stopPropagation()}>
              <Alternatives alternatives={alternatives} finalized={finalized} save={save} />
              {actions}
            </div>
            <Figure value={f.value!} big={f.section === "Nutrition" || f.section === "Quantity"} />
          </div>
        ) : (
          <div className="space-y-2.5 px-4 pb-3 pt-1.5">
            <p
              className={cn(
                "break-words [font-stretch:87.5%]",
                !f.value
                  ? "text-[16px] italic text-ink-faint"
                  : f.value.length > 140
                    ? "text-[16px] font-medium leading-relaxed text-ink"
                    : "text-[19px] font-semibold leading-snug text-ink"
              )}
            >
              {f.value ?? (f.absence ? ABSENCE_TEXT[f.absence] : "Not found in any file")}
            </p>
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <Alternatives alternatives={alternatives} finalized={finalized} save={save} />
              {actions}
            </div>
          </div>
        )}
      </div>

      <div className="code-line flex flex-wrap items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        {f.sources.length ? <SourceLine sources={f.sources} label={f.label} /> : <span>No source</span>}
        {extra > 0 && (
          <button onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} className="inline-flex items-center gap-1 normal-case tracking-normal text-ink-muted hover:text-ink">
            <History className="h-3 w-3" /> {f.notes.length ? `${f.notes.length} note${f.notes.length > 1 ? "s" : ""}` : ""}
            {f.notes.length && f.history.length ? " · " : ""}
            {f.history.length ? `${f.history.length} change${f.history.length > 1 ? "s" : ""}` : ""}
            <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", showMore && "rotate-180")} />
          </button>
        )}
      </div>
      {extra > 0 && (
        <div className="disclosure" data-open={showMore}>
          <div>
            <div className="space-y-1.5 border-t border-line bg-ground/60 px-4 py-2.5 text-xs text-ink-2">
              {f.notes.map((n, i) => (
                <p key={`n${i}`} className="leading-relaxed">{n}</p>
              ))}
              {f.history.map((h, i) => (
                <p key={`h${i}`} className="text-xs tabular-nums text-ink-muted">
                  {h.at.slice(0, 16).replace("T", " ")} · {h.by} ({ORIGIN_TEXT[h.origin ?? "human"]}): “{h.old ?? "empty"}” → “{h.new ?? "empty"}”{h.reason ? ` · ${h.reason}` : ""}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function Alternatives({
  alternatives,
  finalized,
  save,
}: {
  alternatives: BriefField["candidates"];
  finalized: boolean;
  save: (value: string, reason: string) => void;
}) {
  if (!alternatives.length) return null;
  return (
    <div className="space-y-1.5">
      {alternatives.map((c, i) => {
        const short = FIGURE_RE.test(c.value);
        return (
          <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-dashed border-talker-deep/40 bg-talker-soft px-2 py-1.5 text-xs text-ink-2">
            <span className="text-ink-muted">{sourceLabel(c.source)} says</span>
            <b className={cn("text-ink", short ? "figure text-[20px]" : "font-semibold")}>{short ? c.value : `“${c.value.slice(0, 160)}${c.value.length > 160 ? "…" : ""}”`}</b>
            {!finalized && (
              <Button size="sm" variant="outline" className="h-6 border-ink px-2" onClick={() => save(c.value, `Chose the value from ${sourceLabel(c.source)}`)}>
                Use this
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
