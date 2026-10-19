"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, HelpCircle, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExtractionView } from "@/components/analysis/ExtractionView";
import { IssuesList } from "@/components/analysis/IssuesList";
import { useBriefStore } from "@/store/briefStore";
import { api, MOCK_BRIEF, MOCK_EXTRACTION, MOCK_ISSUES } from "@/lib/api";

export default function AnalysisPage() {
  const router = useRouter();
  const {
    sessionId,
    extractionData,
    issues,
    brief,
    setExtractionData,
    setIssues,
    setBrief,
    setSessionId,
    completeStep,
    setStep,
  } = useBriefStore();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // If visited directly without prior upload, initialize with mock dataset
  useEffect(() => {
    if (!sessionId || !brief) {
      setSessionId("demo-session-42");
      setBrief(MOCK_BRIEF);
      setIssues(MOCK_ISSUES);
      setExtractionData(MOCK_EXTRACTION);
    }
  }, [sessionId, brief, setSessionId, setBrief, setIssues, setExtractionData]);

  const handleContinue = () => {
    completeStep("analysis");
    setStep("questions");
    router.push("/questions");
  };

  const handleReanalyze = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.analyze(sessionId || "demo-session-42");
      setBrief(res.brief);
      setIssues(res.issues);
      if (res.extraction) setExtractionData(res.extraction);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <span>Step 2 of 5</span>
            <span>•</span>
            <span>Document Understanding & Validation</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Extraction & Conflict Analysis
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            AI extracted layout panels and text blocks while deterministic logic checked for math and regulatory conflicts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReanalyze}
            disabled={isRefreshing}
            className="gap-2 text-slate-600"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Re-run Audit
          </Button>

          <Button onClick={handleContinue} className="gap-2 shadow-sm">
            Continue to Questions
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Audit Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 via-red-50 to-orange-50 border border-amber-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {criticalCount} Critical Issue{criticalCount > 1 ? "s" : ""} & {warningCount} Warning{warningCount > 1 ? "s" : ""} Flagged
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Sugars vs carbohydrates math impossibility and Vegan claim vs Honey conflict require resolution before packaging sign-off.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleContinue}
          className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100/60 shrink-0 gap-1.5"
        >
          <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
          Resolve in Smart Questions
        </Button>
      </div>

      {/* Two Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
        {/* Left Panel: ExtractionView (7 cols) */}
        <div className="lg:col-span-7 h-[680px]">
          <ExtractionView extractionData={extractionData} />
        </div>

        {/* Right Panel: IssuesList (5 cols) */}
        <div className="lg:col-span-5 h-[680px]">
          <IssuesList issues={issues} />
        </div>
      </div>

      {/* Bottom Continue bar */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <span className="text-xs text-slate-500">
          Source data verified against GS1, FDA 21 CFR 101, and EU 1169/2011 packaging guidelines.
        </span>
        <Button onClick={handleContinue} size="lg" className="gap-2 px-6">
          Continue to Questions
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
