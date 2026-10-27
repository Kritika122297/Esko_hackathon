"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/Segmented";
import { IssuesList } from "@/components/analysis/IssuesList";
import { BriefEditor } from "@/components/review/BriefEditor";
import { ReadinessCard } from "@/components/review/ReadinessCard";
import { PackInspectorCard } from "@/components/review/PackInspectorCard";
import { ArtworkViewer } from "@/components/shared/ArtworkViewer";
import { ErrorBanner, NoSession, SessionPending } from "@/components/shared/Notice";
import { useSession } from "@/components/shared/useSession";
import { useBriefStore } from "@/store/briefStore";

type Pane = "fields" | "findings" | "log";

/** The change log shows local date and time, the same way the Projects page does. */
function stamp(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 16).replace("T", " ") : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ReviewPage() {
  const { ready, sessionId, view } = useSession();
  const [pane, setPane] = useState<Pane>("fields");
  const { highlight, setHighlight } = useBriefStore();
  const [inspectKey, setInspectKey] = useState<string | null>(null);

  // Talk to the Pack: a click on the artwork selects that element, shows it, and brings its card into view.
  const inspect = (key: string) => {
    setInspectKey(key);
    setPane("fields");
    const f = view?.state.fields.find((x) => x.key === key);
    if (f) {
      const located = [...f.sources, ...f.candidates.map((c) => c.source)].filter((x) => x.bbox);
      setHighlight({ label: f.label, sources: located.length ? located : f.sources });
    }
    // The card may only be on screen after the fields tab has rendered.
    window.setTimeout(() => document.querySelector(`[data-field="${key}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
  };

  // At rest, the first field needing review is selected and shown on the pack.
  useEffect(() => {
    if (!view || highlight) return;
    const first = view.state.fields.find((f) => f.status === "needs_review" && f.sources.some((x) => x.bbox));
    if (first) setHighlight({ label: first.label, sources: first.sources.filter((x) => x.bbox) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.state.session_id]);

  if (!ready) return null;
  if (!sessionId) return <NoSession />;
  if (!view) return <SessionPending />;
  const s = view.state;
  const r = s.readiness;
  const openFindings = s.issues.filter((i) => i.state === "open" && i.detected_by !== "ai").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="heading text-[24px] text-ink">Workbench</h1>
          <p className="mt-0.5 text-[14px] text-ink-muted">Click a value to see it on the pack. Every edit is logged and every check re-runs.</p>
        </div>
        <Button asChild variant="outline" size="lg">
          <Link href="/export">
            Designer brief <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <ErrorBanner />

      {/* Where the brief stands, across the page */}
      <ReadinessCard state={s} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)] xl:gap-8">
        {/* The pack stays in view while the cards scroll, so a value and its proof are always side by side */}
        <div className="min-w-0 space-y-3 lg:sticky lg:top-[var(--stick-top,_130px)] lg:max-h-[calc(100vh_-_var(--stick-top,_130px)_-_16px)] lg:overflow-y-auto lg:pb-1">
          <ArtworkViewer
            pages={view.pages}
            panels={view.panels}
            height={inspectKey ? "max-h-[360px] lg:max-h-[38vh]" : "max-h-[420px] lg:max-h-[calc(100vh_-_var(--stick-top,_130px)_-_130px)]"}
            inspectable={s.fields}
            inspected={inspectKey}
            onInspect={inspect}
          />
          {inspectKey && (
            <div className="pb-3 pr-3">
              <PackInspectorCard fieldKey={inspectKey} onClose={() => setInspectKey(null)} />
            </div>
          )}
        </div>

        {/* One column of readable cards; findings and the log are tabs, not more columns */}
        <div className="min-w-0 space-y-4">
          <Segmented
            label="Workbench view"
            stretch
            value={pane}
            onChange={setPane}
            items={[
              { id: "fields", label: "Brief fields", count: r?.fields_needs_review ?? 0 },
              { id: "findings", label: "Findings", count: openFindings },
              { id: "log", label: "Change log", count: s.change_log.length },
            ]}
          />

          {pane === "fields" && <BriefEditor fields={s.fields} />}

          {pane === "findings" && (
            <section aria-label="Findings" className="sheet p-4 md:p-5">
              <IssuesList issues={s.issues} />
            </section>
          )}

          {pane === "log" && (
            <section aria-label="Change log" className="sheet p-4 md:p-5">
              <ol>
                {s.change_log.length === 0 && <li className="py-3 text-[13.5px] text-ink-muted">No changes yet. Every edit, answer and hand-off will be listed here.</li>}
                {s.change_log
                  .slice()
                  .reverse()
                  .map((c, i) => (
                    <li key={i} className="grid grid-cols-[96px_1fr] gap-3 border-b border-line/70 py-3 text-[13.5px] last:border-0">
                      <span className="tabular-nums text-ink-faint">{stamp(c.at)}</span>
                      <span className="text-ink-2">
                        <b className="font-semibold text-ink">{c.by}</b> · {c.action} {c.field ?? c.issue ?? ""}
                        {c.new != null && <> → “{c.new}”</>}
                        {c.note && <span className="text-ink-muted"> · {c.note}</span>}
                      </span>
                    </li>
                  ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
