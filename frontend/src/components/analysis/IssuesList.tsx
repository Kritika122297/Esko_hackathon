"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Crosshair, RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Issue } from "@/lib/types";
import { useBriefStore } from "@/store/briefStore";
import { Flag, KindLabel, OwnerTag, SeverityFlag } from "@/components/shared/badges";
import { SourceLine } from "@/components/shared/SourceChip";

type Filter = "decisions" | "design" | "info" | "acknowledged" | "all";

export function IssuesList({ issues: allIssues, editable = true }: { issues: Issue[]; editable?: boolean }) {
  // Code findings lead. AI points are kept apart so a reader sees what was calculated before what was suggested.
  const issues = useMemo(() => allIssues.filter((i) => i.detected_by !== "ai"), [allIssues]);
  const aiIssues = useMemo(() => allIssues.filter((i) => i.detected_by === "ai"), [allIssues]);
  const groups = useMemo(
    () => ({
      decisions: issues.filter((i) => i.state === "open" && i.resolution === "data" && i.severity !== "info"),
      design: issues.filter((i) => i.resolution === "design"),
      info: issues.filter((i) => i.state === "open" && i.resolution === "data" && i.severity === "info"),
      acknowledged: issues.filter((i) => i.state === "acknowledged"),
      all: issues,
    }),
    [issues]
  );
  const [filter, setFilter] = useState<Filter>(groups.decisions.length ? "decisions" : "all");
  const shown = groups[filter];
  const tabs: [Filter, string][] = [
    ["decisions", "Decide"],
    ["design", "Designer tasks"],
    ["info", "For info"],
    ["acknowledged", "Passed on"],
    ["all", "All"],
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Filter findings" className="flex flex-wrap gap-1">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className={cn(
              "h-7 rounded border px-2 text-xs font-semibold transition-colors duration-150",
              filter === k ? "border-ink bg-ink text-white" : "border-line text-ink-muted hover:border-ink-faint hover:text-ink"
            )}
          >
            {label} <b className="figure ml-0.5 text-[14px]">{groups[k].length}</b>
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {shown.length === 0 && (
          <p className="ticket p-5 text-center text-sm text-ink-muted">
            {filter === "decisions" ? "No open decisions. Everything is resolved or passed on." : "Nothing in this view."}
          </p>
        )}
        {shown.map((i, idx) => (
          <IssueCard key={i.id} issue={i} editable={editable} index={idx} />
        ))}
        {aiIssues.length > 0 && (
          <details className="rounded border border-dashed border-line-strong bg-ground/50 p-2">
            <summary className="cursor-pointer select-none text-xs font-bold uppercase tracking-wider text-ink-2">
              AI suggestions <b className="figure ml-1 text-[14px]">{aiIssues.length}</b>
              <span className="ml-2 font-normal normal-case tracking-normal text-ink-muted">
                Possible problems the AI noticed. Not calculated, never blocking, always needs a person.
              </span>
            </summary>
            <div className="mt-2 space-y-2">
              {aiIssues.map((i, idx) => (
                <IssueCard key={i.id} issue={i} editable={editable} index={idx} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function IssueCard({ issue, editable, index }: { issue: Issue; editable: boolean; index: number }) {
  const [open, setOpen] = useState(index === 0 && issue.state === "open" && issue.severity === "blocking");
  const [note, setNote] = useState("");
  const { run, setHighlight, highlight, view } = useBriefStore();
  const finalized = view?.state.status === "finalized";
  const locatable = issue.evidence.filter((e) => e.bbox);
  const selected = highlight?.label === issue.title;
  const bodyId = `issue-${issue.id.replace(/[^a-z0-9]/gi, "-")}`;

  return (
    <article
      className={cn("ticket anim-rise overflow-hidden", issue.state === "acknowledged" && "opacity-75", selected && "border-ink shadow-[inset_0_0_0_1px_#121514]")}
      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
    >
      {/* Fixed furniture: severity, kind, owner always in the same place */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 pr-3 pt-2.5">
        <SeverityFlag severity={issue.severity} />
        <KindLabel kind={issue.kind} ai={issue.detected_by === "ai"} />
        <OwnerTag owner={issue.owner} />
      </div>
      <button
        className="flex w-full items-start justify-between gap-2 px-3 pb-2.5 pt-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="text-[14px] font-bold leading-snug text-ink">{issue.title}</span>
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 empty:hidden">
        {issue.resolution === "design" && (
          <span className="rounded bg-ground px-1.5 py-0.5 meta text-ink-2">Designer task</span>
        )}
        {issue.state === "acknowledged" && (
          <span className="rounded bg-ground px-1.5 py-0.5 meta text-ink-2">Passed to agency</span>
        )}
      </div>

      <div id={bodyId} className="disclosure" data-open={open}>
        <div>
          <div className="space-y-2.5 border-t border-line px-3 py-3 text-xs">
            <p className="leading-relaxed text-ink-2">{issue.description}</p>
            {issue.suggestion && (
              <div className="flex items-start gap-2 rounded border border-line bg-stock py-2 pr-2">
                <Flag tone="ok" side="right" className="mt-0.5 shrink-0">
                  Fix
                </Flag>
                <p className="leading-relaxed text-ink">{issue.suggestion}</p>
              </div>
            )}
            {issue.evidence.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Evidence</span>
                  {locatable.length > 0 && (
                    <button
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rail underline decoration-1 underline-offset-2 hover:decoration-2"
                      onClick={() => setHighlight({ label: issue.title, sources: locatable })}
                    >
                      <Crosshair className="h-3 w-3" /> Show on artwork
                    </button>
                  )}
                </div>
                <SourceLine sources={issue.evidence} label={issue.title} />
              </div>
            )}
            {issue.state === "acknowledged" && (
              <p className="rounded bg-ground p-2 text-ink-2">
                Passed to the agency: <i>{issue.acknowledgement}</i>
              </p>
            )}
            {editable && !finalized && issue.resolution === "data" && (
              <div className="pt-1">
                {issue.state === "open" ? (
                  <div className="space-y-1.5">
                    <label htmlFor={`${bodyId}-note`} className="sr-only">
                      Note for the agency
                    </label>
                    <input
                      id={`${bodyId}-note`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Note for the agency (optional)"
                      className="h-8 w-full rounded border border-line-strong bg-stock px-2 text-xs focus:border-ink"
                    />
                    <button
                      className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded border border-ink bg-stock text-xs font-semibold text-ink transition-colors hover:bg-ground"
                      onClick={() => run("Passing to agency", (sid) => api.acknowledge(sid, issue.id, note || "Passed to the agency as an open question."), "Passed to the agency")}
                    >
                      <Send className="h-3.5 w-3.5" /> Pass to agency as open question
                    </button>
                  </div>
                ) : (
                  <button
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong bg-stock px-3 text-xs font-semibold text-ink hover:border-ink"
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
