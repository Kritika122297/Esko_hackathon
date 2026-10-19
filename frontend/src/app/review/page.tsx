"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IssuesList } from "@/components/analysis/IssuesList";
import { BriefEditor } from "@/components/review/BriefEditor";
import { ReadinessCard } from "@/components/review/ReadinessCard";
import { ArtworkViewer } from "@/components/shared/ArtworkViewer";
import { ErrorBanner, Loading, NoSession, PageHead } from "@/components/shared/Notice";
import { useSession } from "@/components/shared/useSession";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

export default function ReviewPage() {
  const { ready, sessionId, view } = useSession();
  const [showLog, setShowLog] = useState(false);
  const [pane, setPane] = useState<"fields" | "findings">("fields");
  const { highlight, setHighlight } = useBriefStore();

  // At rest, the first ticket needing review is selected and shown on the pack.
  useEffect(() => {
    if (!view || highlight) return;
    const first = view.state.fields.find((f) => f.status === "needs_review" && f.sources.some((x) => x.bbox));
    if (first) setHighlight({ label: first.label, sources: first.sources.filter((x) => x.bbox) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.state.session_id]);

  if (!ready) return null;
  if (!sessionId) return <NoSession />;
  if (!view) return <Loading />;
  const s = view.state;

  return (
    <div className="space-y-5">
      <PageHead
        title="Workbench"
        lead="Resolve each ticket in place. Click a value to see where it came from on the pack; every edit is logged and every check re-runs."
        actions={
          <Button asChild variant="outline">
            <Link href="/export">
              Designer brief <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <ErrorBanner />

      {/* Below lg: readiness first, then a switch between the tickets and the findings */}
      <div className="space-y-3 lg:hidden">
        <ReadinessCard state={s} />
        <div role="tablist" aria-label="Workbench view" className="grid grid-cols-2 gap-1 rounded border border-line bg-stock p-1">
          {(["fields", "findings"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={pane === k}
              onClick={() => setPane(k)}
              className={cn("h-9 rounded text-[13px] font-semibold transition-colors", pane === k ? "bg-ink text-white" : "text-ink-muted hover:text-ink")}
            >
              {k === "fields" ? "Brief fields" : "Findings"}{" "}
              <b className="figure ml-0.5 text-[16px]">
                {k === "fields" ? s.readiness?.fields_needs_review ?? 0 : s.issues.filter((i) => i.state === "open").length}
              </b>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.2fr)_minmax(290px,0.8fr)]">
        <div className="hidden xl:block">
          <div className="sticky top-[84px]">
            <ArtworkViewer pages={view.pages} panels={view.panels} height="max-h-[calc(100vh-250px)]" />
          </div>
        </div>

        <div className={cn("min-w-0 space-y-4", pane === "findings" && "hidden lg:block")}>
          <div className="xl:hidden">
            <ArtworkViewer pages={view.pages} panels={view.panels} height="max-h-[420px]" />
          </div>
          <BriefEditor fields={s.fields} />

          <section className="ticket">
            <button
              onClick={() => setShowLog((v) => !v)}
              aria-expanded={showLog}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                <ListChecks className="h-4 w-4" /> Change log
                <b className="figure text-[18px]">{s.change_log.length}</b>
              </span>
              <ChevronDown className={cn("h-4 w-4 text-ink-faint transition-transform duration-200", showLog && "rotate-180")} />
            </button>
            <div className="disclosure" data-open={showLog}>
              <div>
                <ol className="max-h-72 overflow-y-auto border-t border-line px-4 py-2">
                  {s.change_log
                    .slice()
                    .reverse()
                    .map((c, i) => (
                      <li key={i} className="grid grid-cols-[52px_1fr] gap-2 border-b border-line/70 py-1.5 text-xs last:border-0">
                        <span className="text-xs tabular-nums text-ink-muted">{c.at.slice(11, 16)}</span>
                        <span className="text-ink-2">
                          <b className="text-ink">{c.by}</b> · {c.action} {c.field ?? c.issue ?? ""}
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

        <aside className="space-y-4 lg:sticky lg:top-[84px] lg:self-start">
          <div className="hidden lg:block">
            <ReadinessCard state={s} />
          </div>
          <section
            aria-labelledby="findings-h"
            className={cn("ticket flex max-h-[calc(100vh-120px)] min-h-[360px] flex-col p-3", pane === "fields" && "hidden lg:flex")}
          >
            <h2 id="findings-h" className="mb-2 text-label font-bold uppercase text-ink">
              Findings
            </h2>
            <IssuesList issues={s.issues} />
          </section>
        </aside>
      </div>
    </div>
  );
}
