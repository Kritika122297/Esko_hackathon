"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IssuesList } from "@/components/analysis/IssuesList";
import { ArtworkViewer } from "@/components/shared/ArtworkViewer";
import { ErrorBanner, NoSession, PageHead, SessionPending } from "@/components/shared/Notice";
import { useSession } from "@/components/shared/useSession";
import { fileRole } from "@/components/upload/FileDropzone";

export default function AnalysisPage() {
  const { ready, sessionId, view } = useSession();
  if (!ready) return null;
  if (!sessionId) return <NoSession />;
  if (!view) return <SessionPending />;

  const s = view.state;
  const r = s.readiness;
  const filled = s.fields.filter((f) => f.value).length;
  const mainPanels = view.panels.filter((p) => !p.id.includes("_"));
  const pdp = view.panels.find((p) => p.is_main);
  const blocking = s.issues.filter((i) => i.state === "open" && i.severity === "blocking" && i.resolution === "data");
  const definite = s.issues.filter((i) => i.kind === "definite").length;
  const total = Math.max(r?.fields_total ?? 1, 1);
  const optionalEmpty = s.fields.filter((f) => !f.value && !f.mandatory).length;
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="space-y-8">
      <PageHead
        title="Findings"
        lead={`BriefForge read ${s.files.length} file${s.files.length === 1 ? "" : "s"}, filled ${filled} fields with proof, and found ${definite} definite errors by code. ${
          blocking.length ? `${blocking.length} decisions block the brief.` : "Nothing blocks the brief."
        }`}
        actions={
          <Button asChild size="lg">
            <Link href={s.questions.length ? "/questions" : "/review"}>
              {s.questions.length ? `Answer ${s.questions.length} questions` : "Open the workbench"} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <ErrorBanner />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="lg:sticky lg:top-[var(--stick-top)] lg:self-start">
          <ArtworkViewer pages={view.pages} panels={view.panels} height="max-h-[calc(100vh_-_var(--stick-top)_-_110px)]" />
        </div>
        <section aria-labelledby="findings-h" className="sheet flex min-h-[460px] flex-col p-4 lg:sticky lg:top-[var(--stick-top)] lg:max-h-[calc(100vh_-_var(--stick-top)_-_24px)]">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="findings-h" className="heading text-[19px] text-ink">
              Findings
            </h2>
            <span className="text-[12.5px] tabular-nums text-ink-muted">
              <b className="font-semibold text-stop-deep">{blocking.length} blocking</b> · {s.issues.filter((i) => i.detected_by !== "ai").length} found by code
            </span>
          </div>
          <IssuesList issues={s.issues} />
        </section>
      </div>

      <section aria-labelledby="ledger-h" className="sheet overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4 md:px-6">
          <h2 id="ledger-h" className="heading text-[20px] text-ink">
            Read report
          </h2>
          <span className="text-[13px] text-ink-muted">What was read, what passed, and what could not be read</span>
        </div>
        <dl className="divide-y divide-line">
          <LedgerRow label="Files read" figure={s.files.length}>
            <ul className="grid gap-2 sm:grid-cols-2">
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
          <LedgerRow label="Artwork panels" figure={view.pages.length ? mainPanels.length : 0}>
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
      </section>
    </div>
  );
}

function LedgerRow({ label, figure, children }: { label: string; figure: number | string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-5 py-4 md:grid-cols-[190px_minmax(0,1fr)_80px] md:px-6">
      <dt className="text-[14px] font-semibold text-ink md:pt-1">{label}</dt>
      <dd className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">{children}</dd>
      <dd className="figure col-start-2 row-start-1 text-right text-[34px] text-ink md:col-start-3">{figure}</dd>
    </div>
  );
}
