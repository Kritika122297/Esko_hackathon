"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/Segmented";
import { IssuesList } from "@/components/analysis/IssuesList";
import { BriefEditor } from "@/components/review/BriefEditor";
import { ReadinessCard } from "@/components/review/ReadinessCard";
import { PackInspectorCard } from "@/components/review/PackInspectorCard";
import { ArtworkViewer } from "@/components/shared/ArtworkViewer";
import { ErrorBanner, NoSession, PageHead, SessionPending } from "@/components/shared/Notice";
import { useSession } from "@/components/shared/useSession";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

export default function ReviewPage() {
  const { ready, sessionId, view } = useSession();
  const [showLog, setShowLog] = useState(false);
  const [pane, setPane] = useState<"fields" | "findings">("fields");
  const { highlight, setHighlight } = useBriefStore();
  const [inspectKey, setInspectKey] = useState<string | null>(null);

  // Talk to the Pack: a click on the artwork selects that element, shows it, and brings its sheet into view.
  const inspect = (key: string) => {
    setInspectKey(key);
    const f = view?.state.fields.find((x) => x.key === key);
    if (f) {
      const located = [...f.sources, ...f.candidates.map((c) => c.source)].filter((x) => x.bbox);
      setHighlight({ label: f.label, sources: located.length ? located : f.sources });
    }
    document.querySelector(`[data-field="${key}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
  const openFindings = s.issues.filter((i) => i.state === "open" && i.detected_by !== "ai").length;

  return (
    <div className="space-y-6">
      <PageHead
        title="Workbench"
        lead="Resolve each field in place. Click a value to see where it came from on the pack; every edit is logged and every check re-runs."
        actions={
          <Button asChild variant="outline" size="lg">
            <Link href="/export">
              Designer brief <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <ErrorBanner />

      {/* Below lg: readiness first, then a switch between the fields and the findings */}
      <div className="space-y-4 lg:hidden">
        <ReadinessCard state={s} />
        <Segmented
          label="Workbench view"
          stretch
          value={pane}
          onChange={setPane}
          items={[
            { id: "fields", label: "Brief fields", count: s.readiness?.fields_needs_review ?? 0 },
            { id: "findings", label: "Findings", count: openFindings },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,350px)] xl:grid-cols-[minmax(380px,1.2fr)_minmax(0,1fr)_minmax(300px,0.8fr)] xl:gap-7">
        {/* The pack: large, sticky, always in reach of the field it proves */}
        <div className="hidden xl:block">
          <div className="sticky top-[var(--stick-top)] space-y-3">
            <ArtworkViewer
              pages={view.pages}
              panels={view.panels}
              height={inspectKey ? "max-h-[44vh]" : "max-h-[calc(100vh_-_var(--stick-top)_-_120px)]"}
              inspectable={s.fields}
              inspected={inspectKey}
              onInspect={inspect}
            />
            {inspectKey && (
              <div className="max-h-[calc(56vh_-_var(--stick-top)_+_40px)] overflow-y-auto pb-3 pr-3">
                <PackInspectorCard fieldKey={inspectKey} onClose={() => setInspectKey(null)} />
              </div>
            )}
          </div>
        </div>

        <div className={cn("min-w-0 space-y-6", pane === "findings" && "hidden lg:block")}>
          <div className="space-y-3 xl:hidden">
            <ArtworkViewer pages={view.pages} panels={view.panels} height="max-h-[460px]" inspectable={s.fields} inspected={inspectKey} onInspect={inspect} />
            {inspectKey && (
              <div className="pb-3 pr-3">
                <PackInspectorCard fieldKey={inspectKey} onClose={() => setInspectKey(null)} />
              </div>
            )}
          </div>
          <BriefEditor fields={s.fields} />

          <section className="sheet overflow-hidden">
            <button onClick={() => setShowLog((v) => !v)} aria-expanded={showLog} aria-controls="change-log" className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-desk/40">
              <span className="flex items-center gap-2.5 text-[15px] font-semibold text-ink">
                <ListChecks className="h-4 w-4" /> Change log
                <span className="figure text-[19px] text-ink-2">{s.change_log.length}</span>
              </span>
              <ChevronDown className={cn("h-4 w-4 text-ink-faint transition-transform duration-200 ease-out", showLog && "rotate-180")} />
            </button>
            <div id="change-log" className="disclosure" data-open={showLog} aria-hidden={!showLog}>
              <div>
                <ol className="max-h-80 overflow-y-auto border-t border-line px-5 py-2">
                  {s.change_log.length === 0 && <li className="py-3 text-[13px] text-ink-muted">No changes yet. Every edit, answer and hand-off will be listed here.</li>}
                  {s.change_log
                    .slice()
                    .reverse()
                    .map((c, i) => (
                      <li key={i} className="grid grid-cols-[52px_1fr] gap-3 border-b border-line/70 py-2 text-[12.5px] last:border-0">
                        <span className="tabular-nums text-ink-faint">{c.at.slice(11, 16)}</span>
                        <span className="text-ink-2">
                          <b className="font-semibold text-ink">{c.by}</b> · {c.action} {c.field ?? c.issue ?? ""}
                          {c.new != null && <> → “{c.new}”</>}
                          {c.note && <span className="text-ink-muted"> · {c.note}</span>}
                        </span>
                      </li>
                    ))}
                </ol>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-[var(--stick-top)] lg:flex lg:max-h-[calc(100vh_-_var(--stick-top)_-_16px)] lg:flex-col lg:self-start lg:space-y-0 lg:gap-5 lg:overflow-y-auto lg:pb-1">
          <div className="hidden shrink-0 lg:block">
            <ReadinessCard state={s} />
          </div>
          <section
            aria-labelledby="findings-h"
            className={cn("sheet flex min-h-[380px] flex-col p-4 lg:min-h-[280px] lg:flex-1", pane === "fields" && "hidden lg:flex")}
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 id="findings-h" className="heading text-[18px] text-ink">
                Findings
              </h2>
              <span className="text-[12.5px] tabular-nums text-ink-muted">
                <b className="font-semibold text-stop-deep">{s.readiness?.blocking_open ?? 0} blocking</b> · {openFindings} open
              </span>
            </div>
            <IssuesList issues={s.issues} />
          </section>
        </aside>
      </div>
    </div>
  );
}
