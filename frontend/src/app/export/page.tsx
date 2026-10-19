"use client";

import React, { useState } from "react";
import {
  Download,
  Printer,
  FileCheck,
  CheckCircle2,
  FileText,
  FileCode,
  Loader2,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BriefPreview } from "@/components/export/BriefPreview";
import { useBriefStore } from "@/store/briefStore";
import { api, MOCK_BRIEF } from "@/lib/api";

export default function ExportPage() {
  const { brief, sessionId } = useBriefStore();
  const currentBrief = brief || MOCK_BRIEF;

  const [downloadingFormat, setDownloadingFormat] = useState<"docx" | "pdf" | null>(
    null
  );
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleDownload = async (format: "docx" | "pdf") => {
    setDownloadingFormat(format);
    setDownloadSuccess(null);

    try {
      const blob = await api.exportBrief(
        sessionId || "demo-session-42",
        format
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentBrief.product_name.replace(/[^a-zA-Z0-9]/g, "_")}_Packaging_Brief.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess(`Successfully downloaded ${format.toUpperCase()} brief!`);
      setTimeout(() => setDownloadSuccess(null), 5000);
    } catch (err: any) {
      console.error("Export error:", err);
      alert("Failed to export document. Please check backend connection.");
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 py-2">
      {/* Top Header & Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
            <span>Step 5 of 5</span>
            <span>•</span>
            <span>Output Generation</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Export Packaging Brief
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Your brief is finalized, audited, and ready to hand off to packaging designers and prepress production.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/review">
            <Button variant="outline" size="sm" className="gap-1.5 text-slate-600">
              <ArrowLeft className="h-4 w-4" />
              Back to Edit
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-slate-700 bg-white shadow-2xs"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={downloadingFormat !== null}
            onClick={() => handleDownload("docx")}
            className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 bg-white shadow-2xs"
          >
            {downloadingFormat === "docx" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileCode className="h-4 w-4 text-blue-600" />
            )}
            Download DOCX
          </Button>

          <Button
            size="sm"
            disabled={downloadingFormat !== null}
            onClick={() => handleDownload("pdf")}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            {downloadingFormat === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between no-print animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{downloadSuccess}</span>
          </div>
        </div>
      )}

      {/* Brief Preview Document */}
      <BriefPreview brief={currentBrief} />
    </div>
  );
}
