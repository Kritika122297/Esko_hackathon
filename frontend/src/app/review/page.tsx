"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Lock,
  Unlock,
  ArrowRight,
  FileCheck,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BriefEditor } from "@/components/review/BriefEditor";
import { useBriefStore } from "@/store/briefStore";
import { MOCK_BRIEF } from "@/lib/api";

export default function ReviewPage() {
  const router = useRouter();
  const { brief, setBrief, completeStep, setStep } = useBriefStore();
  const currentBrief = brief || MOCK_BRIEF;

  const [bypassCritical, setBypassCritical] = useState(false);

  // Calculate statistics
  let totalFields = 0;
  let confirmedFields = 0;
  let flaggedFields = 0;
  let conflictingFields = 0;

  currentBrief.sections.forEach((sec) => {
    sec.fields.forEach((f) => {
      totalFields++;
      if (f.status === "confirmed") confirmedFields++;
      else if (f.status === "flagged") flaggedFields++;
      else if (f.status === "conflicting") conflictingFields++;
    });
  });

  const completionPercent = Math.round(
    (confirmedFields / Math.max(totalFields, 1)) * 100
  );

  const hasCriticalConflict = conflictingFields > 0 && !bypassCritical;

  const handleFinalize = () => {
    // Mark brief as finalized
    const updated = {
      ...currentBrief,
      status: "finalized" as const,
    };
    setBrief(updated);
    completeStep("review");
    setStep("export");
    router.push("/export");
  };

  return (
    <div className="space-y-6 py-2">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <span>Step 4 of 5</span>
            <span>•</span>
            <span>Human-in-the-Loop Verification</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Review & Edit Packaging Brief
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Inspect every field, verify extracted source provenance, edit values inline, and approve final specs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="lg"
            onClick={handleFinalize}
            disabled={hasCriticalConflict}
            className="gap-2 shadow-sm"
          >
            {hasCriticalConflict ? (
              <>
                <Lock className="h-4 w-4" />
                Resolve Conflicts to Finalize
              </>
            ) : (
              <>
                <FileCheck className="h-4 w-4" />
                Finalize Brief
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Grid: Editor (8 cols) + Summary Card (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Brief Sections Form */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs uppercase font-semibold text-slate-400">
                Product Specification
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                {currentBrief.product_name}
              </h2>
            </div>
            <Badge
              variant={
                currentBrief.status === "finalized" ? "success" : "secondary"
              }
              className="text-xs font-semibold uppercase"
            >
              {currentBrief.status}
            </Badge>
          </div>

          <BriefEditor brief={currentBrief} />
        </div>

        {/* Right Side: Sticky Audit Sidebar */}
        <div className="lg:col-span-4 space-y-4 sticky top-20">
          {/* Readiness & Completion Card */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center justify-between text-slate-900">
                <span>Brief Readiness</span>
                <span className="text-blue-600 font-mono text-base">
                  {completionPercent}%
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <Progress value={completionPercent} className="h-2.5" />

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-900">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                    Confirmed
                  </span>
                  <span className="text-lg font-bold font-mono">
                    {confirmedFields}
                  </span>
                  <span className="text-[10px] text-emerald-600 block">
                    of {totalFields} fields
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-900">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">
                    Warnings
                  </span>
                  <span className="text-lg font-bold font-mono">
                    {flaggedFields}
                  </span>
                  <span className="text-[10px] text-amber-600 block">
                    flagged items
                  </span>
                </div>
              </div>

              {conflictingFields > 0 && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2">
                  <div className="flex items-center gap-2 text-red-800 text-xs font-bold">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{conflictingFields} Critical Conflict Unresolved</span>
                  </div>
                  <p className="text-[11px] text-red-700 leading-tight">
                    Deterministic math or ingredient-claim contradictions block final packaging release.
                  </p>
                  <label className="flex items-center gap-2 text-[11px] text-red-900 font-medium cursor-pointer pt-1 border-t border-red-200">
                    <input
                      type="checkbox"
                      checked={bypassCritical}
                      onChange={(e) => setBypassCritical(e.target.checked)}
                      className="rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    Acknowledge & allow finalization override
                  </label>
                </div>
              )}

              {conflictingFields === 0 && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>All critical math checks passed. Ready to lock specs!</span>
                </div>
              )}

              <Button
                size="lg"
                onClick={handleFinalize}
                disabled={hasCriticalConflict}
                className="w-full gap-2 mt-2"
              >
                {hasCriticalConflict ? (
                  <>
                    <Lock className="h-4 w-4" />
                    Finalize Locked
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4" />
                    Finalize & Proceed to Export
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Open Questions Callout */}
          {currentBrief.open_questions && currentBrief.open_questions.length > 0 && (
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  Agency Open Questions ({currentBrief.open_questions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-3 space-y-2">
                <p className="text-[11px] text-slate-500">
                  These items will be included in the design brief header for the packaging design agency to review.
                </p>
                <ul className="space-y-1.5">
                  {currentBrief.open_questions.map((q, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 flex items-start gap-1.5"
                    >
                      <span className="font-bold text-blue-600 text-[11px] shrink-0">
                        {idx + 1}.
                      </span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
