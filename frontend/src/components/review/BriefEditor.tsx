"use client";

import { useMemo, useState } from "react";
import { Ban, Check, ChevronDown, Crosshair, History, Loader2, Pencil, Radar, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/Segmented";
import { api } from "@/lib/api";
import { Absence, BriefField, ImpactPreview, Origin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";
import { StatusStamp } from "@/components/shared/badges";
import { useChangeKey } from "@/components/shared/useChangeKey";
import { SearchBox, matchesQuery } from "@/components/shared/SearchBox";
import { SourceLine, sourceLabel } from "@/components/shared/SourceChip";
import { ImpactPanel } from "./ImpactPanel";

const SECTION_ORDER = ["Product", "Legal & Identity", "Ingredients & Allergens", "Claims & Certifications", "Quantity", "Nutrition", "Other Pack Copy", "Production specs", "Project"];
type Filter = "needs_review" | "missing" | "confirmed" | "all";
const slug = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, "-");

export function BriefEditor({ fields }: { fields: BriefField[] }) {
  // Production specs are always listed, even when empty: the agency simulator asks for them.
  const relevant = useMemo(
    () => fields.filter((f) => f.value || f.mandatory || f.not_applicable || f.section === "Production specs"),
    [fields]
  );
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
  const [query, setQuery] = useState("");
  const inTab = relevant.filter((f) => filter === "all" || f.status === filter);
  const shown = inTab.filter((f) => matchesQuery(query, f.label, f.key, f.key.replace(/_/g, " "), f.value));
  const searching = query.trim().length > 0;
  const sections = SECTION_ORDER.map((s) => ({ name: s, fields: shown.filter((f) => f.section === s) })).filter((s) => s.fields.length);
  const tabs: [Filter, string][] = [
    ["needs_review", "Needs review"],
    ["missing", "Missing"],
    ["confirmed", "Confirmed"],
    ["all", "All"],
  ];

  return (
    <section aria-labelledby="brief-fields-h" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="brief-fields-h" className="heading text-[21px] text-ink">
          Brief fields
        </h2>
        <SearchBox
          id="field-search"
          label="Search fields"
          value={query}
          onChange={setQuery}
          placeholder="Search by field name or value"
          count={shown.length}
          noun={["field", "fields"]}
          size="sm"
          className="w-full sm:w-64"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented label="Filter fields" size="sm" value={filter} onChange={setFilter} items={tabs.map(([k, label]) => ({ id: k, label, count: counts[k] }))} />
        {searching && (
          <p className="text-[12.5px] text-ink-muted" aria-hidden>
            Showing {shown.length} of {inTab.length}
          </p>
        )}
      </div>
      {/* Jump to a section; each chip says how many of its fields still need a person */}
      {sections.length > 1 && (
        <nav
          aria-label="Jump to a section"
          className="sticky top-[calc(var(--stick-top,_120px)_-_14px)] z-20 -mx-2 mt-3 flex gap-1.5 overflow-x-auto bg-desk/95 px-2 py-2 backdrop-blur-[2px] [scrollbar-width:thin]"
        >
          {sections.map((sec) => {
            const todo = sec.fields.filter((f) => f.status !== "confirmed").length;
            return (
              <button
                key={sec.name}
                type="button"
                onClick={() => document.getElementById(`sec-${slug(sec.name)}`)?.scrollIntoView({ block: "start", behavior: "smooth" })}
                className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-line bg-paper px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
              >
                {sec.name}
                <span className={cn("figure text-[15px]", todo ? "text-ink" : "text-mint-deep")}>
                  {todo || <Check className="inline h-3.5 w-3.5" strokeWidth={3.5} aria-label="all confirmed" />}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {sections.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
          {searching ? (
            <>
              <p className="heading text-[17px] text-ink">No field matches “{query.trim()}”.</p>
              <p className="mt-1 text-[13px] text-ink-muted">{filter === "all" ? "Try another word, or clear the search." : "Try another word, or search all fields."}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setQuery("")}>
                  Clear search
                </Button>
                {filter !== "all" && (
                  <Button size="sm" variant="ghost" onClick={() => setFilter("all")}>
                    Search all fields
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="heading text-[17px] text-ink">{filter === "missing" ? "Nothing is missing." : filter === "needs_review" ? "Nothing left to review." : "Nothing in this view."}</p>
              <p className="mt-1 text-[13px] text-ink-muted">Switch the filter to see other fields.</p>
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {sections.map((s) => {
            const open = s.fields.filter((f) => f.status !== "confirmed").length;
            return (
              <div key={s.name} id={`sec-${slug(s.name)}`} className="scroll-mt-[calc(var(--stick-top,_120px)_+_44px)]">
                <div className="section-rule mb-3">
                  <h3 className="text-[15px] font-semibold text-ink">{s.name}</h3>
                  <span className={cn("text-[12.5px]", open ? "text-ink-muted" : "text-mint-deep")}>{open ? `${open} to resolve` : "All confirmed"}</span>
                </div>
                <div className="space-y-3">
                  {s.fields.map((f) => (
                    <FieldSheet key={f.key} f={f} />
                  ))}
                </div>
              </div>
            );
          })}
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
    <span className={cn("figure inline-flex items-start whitespace-nowrap text-ink", big ? "text-[60px]" : "text-[44px]")}>
      {m[1]}
      {m[2] && <span className={cn("ml-1 mt-1 leading-none", big ? "text-[24px]" : "text-[18px]")}>{m[2]}</span>}
    </span>
  );
}

function FieldSheet({ f }: { f: BriefField }) {
  const { run, setHighlight, highlight, view, busy } = useBriefStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(f.value ?? "");
  const [impact, setImpact] = useState<ImpactPreview | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  // The value is re-written in place when it or its status changes after the first render.
  const writeKey = useChangeKey(`${f.value}|${f.status}`);
  const finalized = view?.state.status === "finalized";
  const sid = view?.state.session_id ?? "";
  const located = [...f.sources, ...f.candidates.map((c) => c.source)].filter((s) => s.bbox);
  const selected = highlight?.label === f.label;
  const norm = (v: string | null) => (v ?? "").toLowerCase().replace(/[^a-z0-9%]/g, "");
  const alternatives = f.candidates.filter((c, i, all) => norm(c.value) !== norm(f.value) && all.findIndex((x) => norm(x.value) === norm(c.value)) === i);
  const isFigure = Boolean(f.value && FIGURE_RE.test(f.value));
  const long = (f.value ?? "").length > 70;
  const extra = f.notes.length + f.history.length;

  const preview = async () => {
    setLoadingImpact(true);
    setImpactError(null);
    try {
      setImpact(await api.impact(sid, f.key, draft));
    } catch (e) {
      setImpact(null);
      setImpactError(e instanceof Error && e.message ? e.message : "The preview did not load.");
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
      {f.status !== "confirmed" && f.value && (
        <Button size="sm" disabled={!!busy} onClick={() => run("Confirming", (s) => api.confirmField(s, f.key), "Confirmed")}>
          <Check className="h-3.5 w-3.5" /> Confirm
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setDraft(f.value ?? "");
          setEditing(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" /> {f.value ? "Edit" : "Add value"}
      </Button>
      {!f.value && !f.not_applicable && (
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={markNA}>
          <Ban className="h-3.5 w-3.5" /> Not applicable
        </Button>
      )}
      {f.history.length > 0 && (
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("Undoing", (s) => api.undoField(s, f.key), "Last change undone")}>
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </Button>
      )}
    </div>
  );

  return (
    <article
      aria-label={f.label}
      data-field={f.key}
      className={cn(
        "sheet transition-[border-color,box-shadow] duration-200",
        located.length > 0 && !editing && "cursor-pointer",
        selected ? "border-ink shadow-selected" : located.length > 0 && "hover:border-line-strong"
      )}
      onClick={() => located.length && !editing && setHighlight({ label: f.label, sources: located })}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h4 className="text-[13.5px] font-semibold text-ink-2">{f.label}</h4>
          {f.mandatory && <span className="text-[11.5px] font-medium text-ink-faint">Required</span>}
          {f.user_confirmed && <span className="text-[11.5px] font-semibold text-mint-deep">Reviewer-approved</span>}
          {selected && located.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink">
              <Crosshair className="h-3 w-3" aria-hidden /> On the pack
            </span>
          )}
        </div>
        <StatusStamp status={f.status} />
      </div>

      <div key={`val-${writeKey}`} className={cn(writeKey > 0 && "anim-write")}>
        {editing ? (
          <div className="space-y-2.5 px-5 pb-4 pt-3" onClick={(e) => e.stopPropagation()}>
            <label className="sr-only" htmlFor={`edit-${f.key}`}>
              New value for {f.label}
            </label>
            {long ? (
              <textarea
                id={`edit-${f.key}`}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setImpact(null);
                  setImpactError(null);
                }}
                rows={4}
                className="w-full rounded-md border border-line-strong bg-paper p-3 text-[14px] leading-relaxed focus:border-ink"
              />
            ) : (
              <input
                id={`edit-${f.key}`}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setImpact(null);
                  setImpactError(null);
                }}
                className="h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[14px] focus:border-ink"
                autoFocus
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!!busy || !draft.trim()} onClick={() => save(draft, "Edited in review")}>
                <Check className="h-3.5 w-3.5" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={preview} disabled={loadingImpact || !draft.trim()}>
                {loadingImpact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />} Preview impact
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setImpact(null);
                  setImpactError(null);
                  setDraft(f.value ?? "");
                }}
                aria-label="Cancel edit"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
            {impactError && (
              <p role="alert" className="text-[12.5px] text-stop-deep">
                <b className="font-semibold">Impact preview failed.</b> {impactError}
              </p>
            )}
            {impact && <ImpactPanel p={impact} />}
          </div>
        ) : isFigure ? (
          <div className="grid grid-cols-[1fr_auto] items-end gap-4 px-5 pb-4 pt-2">
            <div className="min-w-0 space-y-2.5" onClick={(e) => e.stopPropagation()}>
              <Alternatives alternatives={alternatives} finalized={finalized} busy={!!busy} save={save} />
              {actions}
            </div>
            <Figure value={f.value!} big={f.section === "Nutrition" || f.section === "Quantity"} />
          </div>
        ) : (
          <div className="space-y-3 px-5 pb-4 pt-2">
            {f.value ? (
              <p
                className={cn(
                  "break-words text-ink",
                  f.value.length > 140 ? "text-[15px] leading-relaxed" : "heading text-[19px] leading-snug [font-variation-settings:'opsz'_24,'wdth'_94]"
                )}
              >
                {f.value}
              </p>
            ) : (
              <p className="inline-flex items-center gap-2 rounded-md border border-dashed border-line-strong px-2.5 py-1.5 text-[14px] text-ink-muted">
                {f.absence ? ABSENCE_TEXT[f.absence] : "Not found in any file"}
              </p>
            )}
            <div className="space-y-2.5" onClick={(e) => e.stopPropagation()}>
              <Alternatives alternatives={alternatives} finalized={finalized} busy={!!busy} save={save} />
              {actions}
            </div>
          </div>
        )}
      </div>

      <div className="code-line flex flex-wrap items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        {f.sources.length ? <SourceLine sources={f.sources} label={f.label} /> : <span>No source</span>}
        {extra > 0 && (
          <button
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="inline-flex items-center gap-1 rounded-md px-1 text-[12px] font-medium text-ink-muted hover:text-ink"
          >
            <History className="h-3 w-3" /> {f.notes.length ? `${f.notes.length} note${f.notes.length > 1 ? "s" : ""}` : ""}
            {f.notes.length && f.history.length ? " · " : ""}
            {f.history.length ? `${f.history.length} change${f.history.length > 1 ? "s" : ""}` : ""}
            <ChevronDown className={cn("h-3 w-3 transition-transform duration-200 ease-out", showMore && "rotate-180")} />
          </button>
        )}
      </div>
      {extra > 0 && (
        <div className="disclosure" data-open={showMore} aria-hidden={!showMore}>
          <div>
            <div className="space-y-1.5 rounded-b-lg border-t border-line bg-desk/50 px-5 py-3 text-[12.5px] text-ink-2">
              {f.notes.map((n, i) => (
                <p key={`n${i}`} className="leading-relaxed">
                  {n}
                </p>
              ))}
              {f.history.map((h, i) => (
                <p key={`h${i}`} className="tabular-nums text-ink-muted">
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
  busy,
  save,
}: {
  alternatives: BriefField["candidates"];
  finalized: boolean;
  busy: boolean;
  save: (value: string, reason: string) => void;
}) {
  if (!alternatives.length) return null;
  return (
    <div className="space-y-1.5">
      {alternatives.map((c, i) => {
        const short = FIGURE_RE.test(c.value);
        return (
          <div key={i} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md border border-dashed border-canary-deep/35 bg-canary-soft px-3 py-2 text-[12.5px] text-ink-2">
            <span className="text-ink-muted">{sourceLabel(c.source)} says</span>
            <b className={cn("min-w-0 text-ink", short ? "figure text-[22px]" : "font-semibold")}>{short ? c.value : `“${c.value.slice(0, 160)}${c.value.length > 160 ? "…" : ""}”`}</b>
            {!finalized && (
              <Button size="sm" variant="outline" className="ml-auto h-7 border-ink px-2.5" disabled={busy} onClick={() => save(c.value, `Chose the value from ${sourceLabel(c.source)}`)}>
                Use this
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
