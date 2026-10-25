"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Crosshair, Lightbulb, RotateCcw, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Issue } from "@/lib/types";
import { useBriefStore } from "@/store/briefStore";
import { KindLabel, OwnerTag, SeverityStamp, Stamp } from "@/components/shared/badges";
import { SourceLine } from "@/components/shared/SourceChip";
import { SearchBox, matchesQuery } from "@/components/shared/SearchBox";
import { Segmented } from "@/components/ui/Segmented";

type Filter = "decisions" | "design" | "other";

export function IssuesList({ issues: allIssues, editable = true }: { issues: Issue[]; editable?: boolean }) {
  // Keeps the search field id unique if more than one list is on the page.
  const idBase = useId().replace(/:/g, "");
  // Code findings lead. AI points are kept apart so a reader sees what was calculated before what was suggested.
  const issues = useMemo(() => allIssues.filter((i) => i.detected_by !== "ai"), [allIssues]);
  const aiIssues = useMemo(() => allIssues.filter((i) => i.detected_by === "ai"), [allIssues]);
  // Three views cover every finding: what needs a decision, what is the designer's, and everything else
  // (for information, passed to the agency, or already resolved).
  const groups = useMemo(() => {
    const decisions = issues.filter((i) => i.state === "open" && i.resolution === "data" && i.severity !== "info");
    const design = issues.filter((i) => i.resolution === "design");
    const taken = new Set([...decisions, ...design].map((i) => i.id));
    return { decisions, design, other: issues.filter((i) => !taken.has(i.id)) } as Record<Filter, Issue[]>;
  }, [issues]);
  const [filter, setFilter] = useState<Filter>(groups.decisions.length ? "decisions" : groups.design.length ? "design" : "other");
  const [query, setQuery] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const fields = useBriefStore((s) => s.view?.state.fields);
  const labelOf = useMemo(() => new Map((fields ?? []).map((f) => [f.key, f.label])), [fields]);
  const hit = (i: Issue) => matchesQuery(query, i.title, i.description, i.owner, ...i.fields.map((k) => labelOf.get(k) ?? k.replace(/_/g, " ")));
  const searching = query.trim().length > 0;
  const shown = groups[filter].filter(hit);
  const aiShown = aiIssues.filter(hit);
  const tabs: [Filter, string][] = [
    ["decisions", "Decide"],
    ["design", "Designer tasks"],
    ["other", "Info & passed on"],
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Segmented
        label="Filter findings"
        size="sm"
        value={filter}
        onChange={setFilter}
        items={tabs.map(([k, label]) => ({ id: k, label, count: groups[k].length }))}
        stretch
        className="w-full"
      />
      {/* Search only earns its space once the list is long enough to need it */}
      {(allIssues.length > 8 || searching) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <SearchBox
            id={`finding-search-${idBase}`}
            label="Search findings"
            value={query}
            onChange={setQuery}
            placeholder="Search title, description, field or owner"
            count={shown.length + aiShown.length}
            noun={["finding", "findings"]}
            size="sm"
            className="min-w-0 flex-1"
          />
          {searching && (
            <p className="text-[12px] text-ink-muted" aria-hidden>
              Showing {shown.length} of {groups[filter].length}
            </p>
          )}
        </div>
      )}
      <div className="-mx-1 mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto px-1 pb-1">
        {shown.length === 0 && (
          <div className="rounded-lg border border-dashed border-line-strong px-5 py-8 text-center">
            <p className="text-[14px] font-semibold text-ink">
              {searching ? `No finding in this view matches “${query.trim()}”.` : filter === "decisions" ? "No open decisions." : "Nothing in this view."}
            </p>
            {!searching && filter === "decisions" && <p className="mt-1 text-[13px] text-ink-muted">Everything is resolved or passed on.</p>}
          </div>
        )}
        {shown.map((i, idx) => (
          <IssueCard key={i.id} issue={i} editable={editable} index={idx} />
        ))}
        {aiShown.length > 0 && (
          <section className="rounded-lg border border-dashed border-line-strong bg-desk/50">
            <button
              type="button"
              onClick={() => setAiOpen((v) => !v)}
              aria-expanded={aiOpen}
              aria-controls={`ai-findings-${idBase}`}
              className="flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                  <Sparkles className="h-3.5 w-3.5 text-ink-muted" aria-hidden /> AI suggestions <span className="figure text-[16px]">{aiShown.length}</span>
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">Possible problems the AI noticed. Not calculated, never blocking, always needs a person.</span>
              </span>
              <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ease-out", aiOpen && "rotate-180")} aria-hidden />
            </button>
            <div id={`ai-findings-${idBase}`} className="disclosure" data-open={aiOpen} aria-hidden={!aiOpen}>
              <div>
                <div className="space-y-2.5 px-2.5 pb-2.5">
                  {aiShown.map((i, idx) => (
                    <IssueCard key={i.id} issue={i} editable={editable} index={idx} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function IssueCard({ issue, editable, index }: { issue: Issue; editable: boolean; index: number }) {
  const [open, setOpen] = useState(index === 0 && issue.state === "open" && issue.severity === "blocking");
  const [note, setNote] = useState("");
  const { run, setHighlight, highlight, view, busy } = useBriefStore();
  const finalized = view?.state.status === "finalized";
  const locatable = issue.evidence.filter((e) => e.bbox);
  const selected = highlight?.label === issue.title;
  const bodyId = `issue-${issue.id.replace(/[^a-z0-9]/gi, "-")}`;
  const passed = issue.state === "acknowledged";

  return (
    <article className={cn("sheet overflow-hidden transition-[border-color,box-shadow] duration-200", passed && "bg-desk/40", selected && "border-ink shadow-selected")}>
      {/* One row when closed: severity, title, owner. Opening a finding also shows it on the pack. */}
      <button
        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left"
        onClick={() => {
          if (!open && locatable.length > 0) setHighlight({ label: issue.title, sources: locatable });
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <SeverityStamp severity={issue.severity} />
        <span className={cn("min-w-0 flex-1 text-[14.5px] font-semibold leading-snug", passed ? "text-ink-2" : "text-ink")}>{issue.title}</span>
        <OwnerTag owner={issue.owner} />
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ease-out", open && "rotate-180")} />
      </button>
      {(issue.resolution === "design" || passed) && (
        <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
          {issue.resolution === "design" && <Stamp tone="muted">Designer task</Stamp>}
          {passed && (
            <Stamp tone="sky" landed={issue.state}>
              <Send className="h-3 w-3" aria-hidden /> Passed to agency
            </Stamp>
          )}
        </div>
      )}
      {/* The top finding shows its fix without opening, since the fix is what a person came for */}
      {!open && index === 0 && issue.suggestion && !passed && (
        <p className="mx-3.5 mb-3 flex items-start gap-2 rounded-md bg-mint-soft px-2.5 py-2 text-[12.5px] leading-snug text-ink">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-deep" aria-hidden />
          <span className="line-clamp-2">
            <span className="sr-only">Suggested fix: </span>
            {issue.suggestion}
          </span>
        </p>
      )}

      <div id={bodyId} className="disclosure" data-open={open} aria-hidden={!open}>
        <div>
          <div className="space-y-3 border-t border-line px-3.5 py-3.5 text-[13px]">
            <p className="text-[12px] text-ink-muted">
              <KindLabel kind={issue.kind} ai={issue.detected_by === "ai"} />
            </p>
            <p className="leading-relaxed text-ink-2">{issue.description}</p>
            {issue.suggestion && (
              <div className="flex items-start gap-2.5 rounded-md bg-mint-soft px-3 py-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-mint-deep" aria-hidden />
                <p className="leading-relaxed text-ink">
                  <span className="sr-only">Suggested fix: </span>
                  {issue.suggestion}
                </p>
              </div>
            )}
            {issue.evidence.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink-muted">Evidence</span>
                  {locatable.length > 0 && (
                    <button
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold text-ink underline decoration-ink/30 underline-offset-2 hover:bg-canary-soft hover:decoration-ink"
                      onClick={() => setHighlight({ label: issue.title, sources: locatable })}
                    >
                      <Crosshair className="h-3.5 w-3.5" /> Show on artwork
                    </button>
                  )}
                </div>
                <SourceLine sources={issue.evidence} label={issue.title} />
              </div>
            )}
            {passed && (
              <p className="rounded-md bg-sky-soft px-3 py-2 text-ink-2">
                Passed to the agency: <i>{issue.acknowledgement}</i>
              </p>
            )}
            {editable && !finalized && issue.resolution === "data" && (
              <div className="pt-0.5">
                {issue.state === "open" ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label htmlFor={`${bodyId}-note`} className="sr-only">
                      Note for the agency
                    </label>
                    <input
                      id={`${bodyId}-note`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Note for the agency (optional)"
                      className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-paper px-2.5 text-[13px] focus:border-ink"
                    />
                    <button
                      className="pressable inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-ink bg-paper px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-sky-soft disabled:pointer-events-none disabled:opacity-50"
                      disabled={!!busy}
                      onClick={() => run("Passing to agency", (sid) => api.acknowledge(sid, issue.id, note || "Passed to the agency as an open question."), "Passed to the agency")}
                    >
                      <Send className="h-3.5 w-3.5" /> Pass to agency
                    </button>
                  </div>
                ) : (
                  <button
                    className="pressable inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-paper px-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:pointer-events-none disabled:opacity-50"
                    disabled={!!busy}
                    onClick={() => run("Reopening", (sid) => api.reopenIssue(sid, issue.id), "Reopened")}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reopen
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
