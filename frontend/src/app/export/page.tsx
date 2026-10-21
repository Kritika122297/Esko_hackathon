"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesignerBriefView } from "@/components/export/DesignerBriefView";
import { Flag } from "@/components/shared/badges";
import { ErrorBanner, Loading, NoSession, PageHead, SessionPending } from "@/components/shared/Notice";
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

  return (
    <div className="space-y-6">
      <PageHead
        title="Designer brief"
        lead="Written for the design agency. Downloads open with a one-page summary (worded by AI from the checked brief, figures verified by code), then what to change, the approved copy, open questions and a short record of sources."
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/review">
                <ArrowLeft className="h-4 w-4" /> Workbench
              </Link>
            </Button>
            <Button variant="outline" onClick={() => download("docx")} disabled={!!busy || !!preparing} aria-busy={preparing === "docx"}>
              {preparing === "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {preparing === "docx" ? "Preparing…" : "Word"}
            </Button>
            <Button onClick={() => download("pdf")} disabled={!!busy || !!preparing} aria-busy={preparing === "pdf"}>
              {preparing === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {preparing === "pdf" ? "Preparing…" : "Download PDF"}
            </Button>
          </>
        }
      />
      <ErrorBanner />
      {!finalized && (
        <div className="ticket flex flex-wrap items-center gap-3 border-talker-deep/30 bg-talker-soft py-2.5 pr-4">
          <Flag tone="review" side="right">Draft</Flag>
          <p className="text-[13px] text-ink">
            Not finalized yet, so downloads are marked DRAFT. {view.state.readiness?.headline}{" "}
            <Link href="/review" className="font-semibold underline">
              Finish in the workbench
            </Link>
          </p>
        </div>
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
      {brief ? <DesignerBriefView brief={brief} state={view.state} pages={view.pages} panels={view.panels} /> : !error && <Loading what="designer brief" />}
    </div>
  );
}
