"use client";

import { usePathname } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineStep {
  number: number;
  label: string;
  subtext: string;
  associatedRoutes: string[];
}

const PIPELINE_STEPS: PipelineStep[] = [
  { number: 1, label: "Upload", subtext: "Specs & Files", associatedRoutes: ["/upload"] },
  { number: 2, label: "Read", subtext: "Text & Tables", associatedRoutes: ["/upload", "/analysis"] },
  { number: 3, label: "Understand", subtext: "Panel Mapping", associatedRoutes: ["/analysis"] },
  { number: 4, label: "Fill", subtext: "Draft Fields", associatedRoutes: ["/analysis"] },
  { number: 5, label: "Check", subtext: "Math & Rules", associatedRoutes: ["/analysis"] },
  { number: 6, label: "Ask", subtext: "Clarifications", associatedRoutes: ["/questions"] },
  { number: 7, label: "Review", subtext: "Human Audit", associatedRoutes: ["/review"] },
  { number: 8, label: "Finalize", subtext: "Approval Lock", associatedRoutes: ["/review", "/export"] },
  { number: 9, label: "Output", subtext: "PDF & DOCX", associatedRoutes: ["/export"] },
];

const ROUTE_PROGRESS: Record<string, number> = {
  "/upload": 1,
  "/analysis": 5,
  "/questions": 6,
  "/review": 7,
  "/export": 9,
};

export function StepIndicator() {
  const pathname = usePathname();
  const currentStepNumber = ROUTE_PROGRESS[pathname] || 1;

  const progressPercentage = Math.round(
    ((currentStepNumber - 1) / (PIPELINE_STEPS.length - 1)) * 100
  );

  return (
    <div className="w-full bg-white border-b border-slate-200 px-8 py-3.5 shadow-xs sticky top-0 z-30">
      <div className="max-w-7xl mx-auto">
        {/* Top bar with percentage */}
        <div className="flex items-center justify-between text-xs mb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
              Brief Pipeline
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">
              Step {currentStepNumber} of {PIPELINE_STEPS.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">
              {progressPercentage}% Completed
            </span>
            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* 9-step granular tracker */}
        <div className="grid grid-cols-9 gap-1 items-center">
          {PIPELINE_STEPS.map((step, idx) => {
            const isCompleted = step.number < currentStepNumber;
            const isCurrent = step.number === currentStepNumber;
            const isUpcoming = step.number > currentStepNumber;

            return (
              <div
                key={step.number}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded text-left transition-all border",
                  isCurrent
                    ? "bg-blue-50/80 border-blue-300 text-blue-900 font-semibold shadow-xs"
                    : isCompleted
                    ? "bg-slate-50 border-slate-200 text-slate-700 font-medium"
                    : "border-transparent text-slate-400 opacity-60"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold",
                    isCurrent
                      ? "bg-blue-600 text-white"
                      : isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  )}
                >
                  {isCompleted ? <Check className="w-2.5 h-2.5" /> : step.number}
                </div>
                <div className="min-w-0 overflow-hidden leading-none">
                  <div className="text-[11px] truncate">{step.label}</div>
                  <div className="text-[9px] text-slate-400 font-normal truncate hidden xl:block">
                    {step.subtext}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
