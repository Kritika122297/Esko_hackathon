"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Loader2, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { useBriefStore } from "@/store/briefStore";
import { api } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const {
    uploadedFiles,
    setUploadedFiles,
    removeUploadedFile,
    setSessionId,
    setUploadResponse,
    setBrief,
    setIssues,
    setExtractionData,
    completeStep,
    setStep,
  } = useBriefStore();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFilesSelected = (newFiles: File[]) => {
    setUploadedFiles([...uploadedFiles, ...newFiles]);
    setErrorMsg(null);
  };

  const handleLoadSampleFiles = () => {
    // Create mock Files for immediate testability
    const sample1 = new File(
      ["Mock PDF content with packaging die cut lines and nutritional front panel"],
      "Granola_Packaging_Spec_v2.pdf",
      { type: "application/pdf" }
    );
    const sample2 = new File(
      ["Nutrient,Per 100g,Per 30g\nEnergy,400kcal,120kcal\nCarbs,50g,15g\nSugars,60g,18g"],
      "Nutrition_Formula_Rev3.xlsx",
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    );
    const sample3 = new File(
      ["Brand claims: 100% Vegan, High Fiber, Non-GMO Certified"],
      "Brand_Styleguide_Claims.docx",
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }
    );
    setUploadedFiles([sample1, sample2, sample3]);
    setErrorMsg(null);
  };

  const handleAnalyze = async () => {
    if (uploadedFiles.length === 0) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Upload files
      const uploadRes = await api.uploadFiles(uploadedFiles);
      setSessionId(uploadRes.session_id);
      setUploadResponse(uploadRes);

      // 2. Trigger analysis
      const analysisRes = await api.analyze(uploadRes.session_id);
      setBrief(analysisRes.brief);
      setIssues(analysisRes.issues);
      if (analysisRes.extraction) {
        setExtractionData(analysisRes.extraction);
      }

      // 3. Mark upload step complete
      completeStep("upload");
      setStep("analysis");

      // 4. Navigate to Analysis
      router.push("/analysis");
    } catch (err: any) {
      console.error("Analysis pipeline error:", err);
      setErrorMsg(err?.message || "Failed to analyze files. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
          <span>Step 1 of 5</span>
          <span>•</span>
          <span>Data Ingestion</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Upload Product Files
        </h1>
        <p className="text-slate-500 mt-1 text-base">
          Upload packaging PDFs, Excel formula sheets, Word brand guides, or artwork images.
          BriefForge will extract text, understand panels, cross-validate math, and detect inconsistencies.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Dropzone Container */}
      <FileDropzone
        files={uploadedFiles}
        onFilesSelected={handleFilesSelected}
        onFileRemoved={removeUploadedFile}
        onLoadSampleFiles={handleLoadSampleFiles}
      />

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
            <Sparkles className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">
            Panel Understanding
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Distinguishes Front, Back, and Side panels while filtering out technical printer trim marks.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">
            Deterministic Math Check
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Strict code-level checks: Sugar ≤ Carbs, calorie Atwater factors, and serving weight math.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">
            Source Provenance
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Every single field is linked back to the exact PDF page, cell coordinate, or AI inference.
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-200">
        <div className="text-sm text-slate-500">
          {uploadedFiles.length === 0 ? (
            <span>Please select or drop at least one file to proceed.</span>
          ) : (
            <span className="text-slate-900 font-medium">
              {uploadedFiles.length} file{uploadedFiles.length > 1 ? "s" : ""} ready for analysis
            </span>
          )}
        </div>

        <Button
          size="lg"
          onClick={handleAnalyze}
          disabled={uploadedFiles.length === 0 || isLoading}
          className="gap-2 px-6"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing & Checking Rules...
            </>
          ) : (
            <>
              Analyze Files
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
