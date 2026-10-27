"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesignerBriefView } from "@/components/export/DesignerBriefView";
import { Stamp } from "@/components/shared/badges";
import { ErrorBanner, Loading, NoSession, SessionPending } from "@/components/shared/Notice";
import { useSession } from "@/components/shared/useSession";
import { api } from "@/lib/api";
import { DesignerBrief } from "@/lib/types";
import { useBriefStore } from "@/store/briefStore";

type Format = "docx" | "pdf";
const FORMAT_TEXT: Record<Format, string> = { docx: "Word document", pdf: "PDF" };

export default function ExportPage() {
  const { ready, sessionId, view } = useSession();
  const [brief, setBrief] = useState<DesignerBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState<Format | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const busy = useBriefStore((s) => s.busy);
  const updated = view?.state.updated_at;

  // Fetched rather than linked, so a backend error is shown here instead of replacing the page with raw JSON.
  const download = async (fmt: Format) => {
    if (!sessionId || preparing) return;
    setPreparing(fmt);
    setDownloadError(null);
    try {
      const { blob, filename } = await api.exportFile(sessionId, fmt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setDownloadError(`The ${FORMAT_TEXT[fmt]} could not be prepared. ${e instanceof Error ? e.message : ""}`.trim());
    } finally {
      setPreparing(null);
    }
  };

  useEffect(() => {
    if (!sessionId || !updated) return;
    api.designerBrief(sessionId).then(setBrief).catch((e) => setError(e.message));
  }, [sessionId, updated]);

  if (!ready) return null;
  if (!sessionId) return <NoSession />;
  if (!view) return <SessionPending />;
  const finalized = view.state.status === "finalized";

  const downloads = (
    <>
      <Button className="w-full" onClick={() => download("pdf")} disabled={!!busy || !!preparing} aria-busy={preparing === "pdf"}>
        {preparing === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {preparing === "pdf" ? "Preparing…" : "Download PDF"}
      </Button>
      <Button variant="outline" className="w-full" onClick={() => download("docx")} disabled={!!busy || !!preparing} aria-busy={preparing === "docx"}>
        {preparing === "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {preparing === "docx" ? "Preparing…" : "Download Word"}
      </Button>
      <p className="text-[12px] leading-snug text-ink-muted">
        {finalized ? "Hand this to the design agency." : "Marked DRAFT until the brief is finalized."} One summary page, then the changes, approved copy, open questions and sources.
      </p>
    </>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="heading text-[24px] text-ink">Designer brief</h1>
            <Stamp tone={finalized ? "ok" : "review"} landed={view.state.status}>
              {finalized ? "Finalized" : "Draft"}
            </Stamp>
          </div>
          <p className="mt-0.5 text-[14px] text-ink-muted">Written for the design agency: what to change, the approved copy, and what is still open.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/review">
              <ArrowLeft className="h-4 w-4" /> Workbench
            </Link>
          </Button>
          {/* On large screens the downloads live under the section list, so they are not repeated here */}
          <div className="flex gap-2 lg:hidden">
            <Button variant="outline" onClick={() => download("docx")} disabled={!!busy || !!preparing} aria-busy={preparing === "docx"}>
              {preparing === "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {preparing === "docx" ? "Preparing…" : "Word"}
            </Button>
            <Button onClick={() => download("pdf")} disabled={!!busy || !!preparing} aria-busy={preparing === "pdf"}>
              {preparing === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {preparing === "pdf" ? "Preparing…" : "PDF"}
            </Button>
          </div>
        </div>
      </div>
      <ErrorBanner />
      {!finalized && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-canary-deep/25 bg-canary-soft px-4 py-2.5 text-[13.5px] text-ink">
          <span>
            <b className="font-semibold">Not finalized yet,</b> so downloads are marked DRAFT. {view.state.readiness?.headline}
          </span>
          <Link href="/review" className="font-semibold underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
            Finish in the workbench
          </Link>
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {preparing ? `Preparing the ${FORMAT_TEXT[preparing]}. This can take a few seconds.` : ""}
      </p>
      {downloadError && (
        <p role="alert" className="text-sm text-stop-deep">
          {downloadError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-stop-deep">
          {error}
        </p>
      )}
      {brief ? <DesignerBriefView brief={brief} state={view.state} pages={view.pages} panels={view.panels} downloads={downloads} /> : !error && <Loading what="designer brief" />}
    </div>
  );
}
