"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IssuesList } from "@/components/analysis/IssuesList";
import { ArtworkViewer } from "@/components/shared/ArtworkViewer";
import { ErrorBanner, Loading, NoSession, PageHead } from "@/components/shared/Notice";
import { useSession } from "@/components/shared/useSession";
import { fileRole } from "@/components/upload/FileDropzone";

export default function AnalysisPage() {
  const { ready, sessionId, view } = useSession();
  if (!ready) return null;
  if (!sessionId) return <NoSession />;
  if (!view) return <Loading />;

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
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <ArtworkViewer pages={view.pages} panels={view.panels} height="max-h-[620px]" className="self-start" />
        <section aria-labelledby="findings-h" className="ticket flex max-h-[720px] min-h-[420px] flex-col p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 id="findings-h" className="text-label font-bold uppercase text-ink">
              Findings <b className="figure ml-1 text-[18px]">{s.issues.filter((i) => i.detected_by !== "ai").length}</b>
            </h2>
            <span className="text-xs text-ink-muted">Click evidence to see it on the pack</span>
          </div>
          <IssuesList issues={s.issues} />
        </section>
      </div>

      <section aria-labelledby="ledger-h" className="ticket">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          <h2 id="ledger-h" className="text-[16px] font-bold text-ink">
            Read report
          </h2>
          <span className="text-xs text-ink-muted">What was read, what passed, and what could not be read</span>
        </div>
        <dl className="divide-y divide-dashed divide-line">
          <LedgerRow label="Files read" figure={s.files.length}>
            <ul className="space-y-1">
              {s.files.map((f) => (
                <li key={f.name} className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-ink">{f.name}</span>
                  <span className="meta text-ink-muted">
                    {fileRole(f.name).role}
                    {f.pages ? ` · ${f.pages} page${f.pages > 1 ? "s" : ""}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </LedgerRow>
          <LedgerRow label="Artwork panels" figure={view.pages.length ? mainPanels.length : 0}>
            {view.pages.length ? (
              <p className="text-[13px] text-ink-2">
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
              <p className="text-[13px] text-ink-muted">No artwork uploaded, so placement checks were skipped.</p>
            )}
          </LedgerRow>
          <LedgerRow label="Fields with a value" figure={filled}>
            <p className="text-[13px] text-ink-2">
              {r ? (
                <>
                  The workbench tracks {r.fields_total} fields: {r.fields_confirmed} confirmed, {r.fields_needs_review} to review, {r.fields_missing} required fields missing.
                </>
              ) : null}{" "}
              {optionalEmpty > 0 && `${optionalEmpty} optional project ${optionalEmpty === 1 ? "field is" : "fields are"} empty; they are not printed on the pack.`}
            </p>
            {r && (
              <div className="mt-2 flex h-1.5 max-w-md overflow-hidden rounded-sm bg-line" aria-hidden>
                <div className="bg-rail" style={{ width: pct(r.fields_confirmed) }} />
                <div className="bg-talker" style={{ width: pct(r.fields_needs_review) }} />
                <div className="bg-stop" style={{ width: pct(r.fields_missing) }} />
              </div>
            )}
          </LedgerRow>
          <LedgerRow label="Checks passed" figure={s.passed_checks.length}>
            <ul className="space-y-1 text-[13px]">
              {s.passed_checks.length === 0 && <li className="text-ink-muted">None yet.</li>}
              {s.passed_checks.map((p) => (
                <li key={p.check}>
                  <b className="text-ink">{p.title}.</b> <span className="text-ink-muted">{p.detail}</span>
                </li>
              ))}
            </ul>
          </LedgerRow>
          <LedgerRow label="Could not read well" figure={s.extraction_notes.length}>
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-ink-muted [overflow-wrap:anywhere]">
              {s.extraction_notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </LedgerRow>
        </dl>
      </section>
    </div>
  );
}

function LedgerRow({ label, figure, children }: { label: string; figure: number | string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[170px_minmax(0,1fr)_72px]">
      <dt className="text-[13px] font-bold text-ink md:pt-0.5">{label}</dt>
      <dd className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">{children}</dd>
      <dd className="figure col-start-2 row-start-1 text-right text-[30px] text-ink md:col-start-3">{figure}</dd>
    </div>
  );
}
