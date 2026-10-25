"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/Segmented";
import { IssuesList } from "@/components/analysis/IssuesList";
import { ArtworkViewer } from "@/components/shared/ArtworkViewer";
import { ErrorBanner, NoSession, SessionPending } from "@/components/shared/Notice";
import { useSession } from "@/components/shared/useSession";
import { fileRole } from "@/components/upload/FileDropzone";
import { cn } from "@/lib/utils";

type Pane = "findings" | "report";

export default function AnalysisPage() {
  const { ready, sessionId, view } = useSession();
  const [pane, setPane] = useState<Pane>("findings");
  // Full screen: the work area covers the window, for reading findings next to the artwork with room to spare.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded]);
  if (!ready) return null;
  if (!sessionId) return <NoSession />;
  if (!view) return <SessionPending />;

  const s = view.state;
  const r = s.readiness;
  const filled = s.fields.filter((f) => f.value).length;
  const mainPanels = view.panels.filter((p) => !p.id.includes("_"));
  const pdp = view.panels.find((p) => p.is_main);
  // The same blocking number the brief bar shows, so the two never disagree.
  const blocking =
    r?.blocking_open ?? s.issues.filter((i) => i.state === "open" && i.severity === "blocking" && i.resolution === "data").length;
  // Open errors the code calculated; resolved ones and AI suggestions are not counted as "found".
  const definite = s.issues.filter((i) => i.kind === "definite" && i.state === "open" && i.detected_by !== "ai").length;
  const findingCount = s.issues.filter((i) => i.detected_by !== "ai").length;
  const total = Math.max(r?.fields_total ?? 1, 1);
  const optionalEmpty = s.fields.filter((f) => !f.value && !f.mandatory).length;
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="space-y-4">
      {/* The stage tabs above already say where you are, so this is one working row, not a title block */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-6 gap-y-1">
          <h1 className="heading text-[22px] text-ink">Findings</h1>
          <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-ink-muted">
            <Figure n={s.files.length} label={`file${s.files.length === 1 ? "" : "s"} read`} />
            <Figure n={definite} label="open errors found by code" />
            <Figure n={blocking} label="blocking" tone={blocking ? "stop" : undefined} />
          </p>
        </div>
        <Button asChild size="lg">
          <Link href={s.questions.length ? "/questions" : "/review"}>
            {s.questions.length ? `Answer ${s.questions.length} question${s.questions.length === 1 ? "" : "s"}` : "Open the workbench"} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <ErrorBanner />

      {/* On large screens the work area fills what is left of the window: the artwork stays put and only the list scrolls */}
      <div
        className={cn(
          "grid grid-cols-1 gap-5",
          expanded
            ? "fixed inset-0 z-[60] gap-4 overflow-y-auto bg-desk p-4 lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.9fr)] lg:overflow-hidden"
            : "lg:h-[calc(100vh_-_var(--stick-top,_200px)_-_110px)] lg:min-h-[460px] lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]"
        )}
      >
        <ArtworkViewer
          pages={view.pages}
          panels={view.panels}
          height="max-h-[380px] lg:max-h-none lg:min-h-0 lg:flex-1"
          className="self-start lg:h-full lg:self-stretch"
        />
        <section aria-label="Findings and read report" className={cn("sheet flex min-h-[400px] min-w-0 flex-col p-4 lg:h-full lg:max-h-none", expanded ? "max-h-none" : "max-h-[80vh]")}>
          <div className="mb-3 flex items-center gap-2">
            <Segmented
              label="Findings view"
              idPrefix="pane"
              stretch
              value={pane}
              onChange={setPane}
              items={[
                { id: "findings", label: "Findings", count: findingCount },
                { id: "report", label: "Read report" },
              ]}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-pressed={expanded}
              aria-label={expanded ? "Exit full screen" : "Expand to full screen"}
              title={expanded ? "Exit full screen (Esc)" : "Expand to full screen"}
              className="pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line-strong bg-paper px-2.5 text-[12.5px] font-semibold text-ink hover:border-ink"
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="hidden xl:inline">{expanded ? "Exit" : "Expand"}</span>
            </button>
          </div>

          {pane === "findings" ? (
            <div id="pane-panel-findings" role="tabpanel" aria-labelledby="pane-tab-findings" className="flex min-h-0 flex-1 flex-col">
              <IssuesList issues={s.issues} />
            </div>
          ) : (
            <div id="pane-panel-report" role="tabpanel" aria-labelledby="pane-tab-report" className="min-h-0 flex-1 overflow-y-auto pr-1">
              <p className="text-[12.5px] text-ink-muted">What was read, what passed, and what could not be read.</p>
              <dl className="divide-y divide-line">
                <LedgerRow label="Files read" figure={s.files.length}>
                  <ul className="space-y-1.5">
                    {s.files.map((f) => (
                      <li key={f.name} className="min-w-0 rounded-md bg-desk/60 px-3 py-2">
                        <span className="block truncate text-[13.5px] font-semibold text-ink" title={f.name}>
                          {f.name}
                        </span>
                        <span className="meta">
                          {fileRole(f.name).role}
                          {f.pages ? ` · ${f.pages} page${f.pages > 1 ? "s" : ""}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </LedgerRow>
                {/* No artwork is "–", not a failing zero */}
                <LedgerRow label="Artwork panels" figure={view.pages.length ? mainPanels.length : "–"}>
                  {view.pages.length ? (
                    <p className="text-[13.5px] leading-relaxed text-ink-2">
                      {pdp ? (
                        <>
                          Principal display panel found: <b className="text-ink">{pdp.label}</b>.
                        </>
                      ) : (
                        "No principal display panel found."
                      )}{" "}
                      {view.panels.length - mainPanels.length} flaps mapped. Printing-guide marks were ignored and hidden layers were checked.
                    </p>
                  ) : (
                    <p className="text-[13.5px] text-ink-muted">No artwork uploaded, so placement checks were skipped.</p>
                  )}
                </LedgerRow>
                <LedgerRow label="Fields with a value" figure={filled}>
                  <p className="text-[13.5px] leading-relaxed text-ink-2">
                    {r ? (
                      <>
                        The workbench tracks {r.fields_total} fields: {r.fields_confirmed} confirmed, {r.fields_needs_review} to review, {r.fields_missing} required fields missing.
                      </>
                    ) : null}{" "}
                    {optionalEmpty > 0 && `${optionalEmpty} optional project ${optionalEmpty === 1 ? "field is" : "fields are"} empty; they are not printed on the pack.`}
                  </p>
                  {r && (
                    <div className="mt-3 max-w-md">
                      <div className="flex h-2 overflow-hidden rounded-full bg-desk-2" aria-hidden>
                        <div className="bg-mint-deep" style={{ width: pct(r.fields_confirmed) }} />
                        <div className="bg-canary" style={{ width: pct(r.fields_needs_review) }} />
                        <div className="bg-line-strong" style={{ width: pct(r.fields_missing) }} />
                      </div>
                      <p className="mt-1.5 flex flex-wrap gap-x-4 text-[12px] text-ink-muted" aria-hidden>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-mint-deep" /> Confirmed</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-canary" /> To review</span>
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-dashed border-ink-faint" /> Missing</span>
                      </p>
                    </div>
                  )}
                </LedgerRow>
                <LedgerRow label="Checks passed" figure={s.passed_checks.length}>
                  <ul className="space-y-1.5 text-[13.5px]">
                    {s.passed_checks.length === 0 && <li className="text-ink-muted">None yet.</li>}
                    {s.passed_checks.map((p) => (
                      <li key={p.check} className="leading-snug">
                        <b className="font-semibold text-ink">{p.title}.</b> <span className="text-ink-muted">{p.detail}</span>
                      </li>
                    ))}
                  </ul>
                </LedgerRow>
                <LedgerRow label="Could not read well" figure={s.extraction_notes.length}>
                  {s.extraction_notes.length === 0 ? (
                    <p className="text-[13.5px] text-ink-muted">Everything was read.</p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-4 text-[13.5px] text-ink-muted [overflow-wrap:anywhere]">
                      {s.extraction_notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  )}
                </LedgerRow>
              </dl>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Figure({ n, label, tone }: { n: number; label: string; tone?: "stop" }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <b className={cn("figure text-[26px]", tone === "stop" ? "text-stop-deep" : "text-ink")}>{n}</b>
      {label}
    </span>
  );
}

/** Stacked on purpose: this sits in a narrow card, so label and figure share a row and the detail runs below. */
function LedgerRow({ label, figure, children }: { label: string; figure: number | string; children: React.ReactNode }) {
  return (
    <div className="py-3.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <dt className="text-[14px] font-semibold text-ink">{label}</dt>
        <dd className="figure text-[28px] text-ink">{figure}</dd>
      </div>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
