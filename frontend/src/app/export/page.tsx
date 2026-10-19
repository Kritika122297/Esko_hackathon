"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesignerBriefView } from "@/components/export/DesignerBriefView";
import { Flag } from "@/components/shared/badges";
import { ErrorBanner, Loading, NoSession, PageHead } from "@/components/shared/Notice";
import { useSession } from "@/components/shared/useSession";
import { api } from "@/lib/api";
import { DesignerBrief } from "@/lib/types";

export default function ExportPage() {
  const { ready, sessionId, view } = useSession();
  const [brief, setBrief] = useState<DesignerBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updated = view?.state.updated_at;

  useEffect(() => {
    if (!sessionId || !updated) return;
    api.designerBrief(sessionId).then(setBrief).catch((e) => setError(e.message));
  }, [sessionId, updated]);

  if (!ready) return null;
  if (!sessionId) return <NoSession />;
  if (!view) return <Loading />;
  const finalized = view.state.status === "finalized";

  return (
    <div className="space-y-6">
      <PageHead
        title="Designer brief"
        lead="Written for the design agency: what to keep, change, add and remove on each panel, the approved copy, the open questions, and proof for every value."
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/review">
                <ArrowLeft className="h-4 w-4" /> Workbench
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={api.exportUrl(sessionId, "docx")}>
                <FileText className="h-4 w-4" /> Word
              </a>
            </Button>
            <Button asChild>
              <a href={api.exportUrl(sessionId, "pdf")}>
                <Download className="h-4 w-4" /> Download PDF
              </a>
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
      {error && (
        <p role="alert" className="text-sm text-stop-deep">
          {error}
        </p>
      )}
      {brief ? <DesignerBriefView brief={brief} state={view.state} pages={view.pages} panels={view.panels} /> : !error && <Loading what="designer brief" />}
    </div>
  );
}
