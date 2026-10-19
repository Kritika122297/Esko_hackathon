"use client";

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Lightbulb,
  FileSearch,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Issue, IssueSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";

interface IssuesListProps {
  issues: Issue[];
}

export function IssuesList({ issues }: IssuesListProps) {
  const criticalIssues = issues.filter((i) => i.severity === "critical");
  const warningIssues = issues.filter((i) => i.severity === "warning");
  const infoIssues = issues.filter((i) => i.severity === "info");

  const getSeverityMeta = (sev: IssueSeverity) => {
    switch (sev) {
      case "critical":
        return {
          icon: AlertCircle,
          badgeVariant: "destructive" as const,
          color: "text-red-700 bg-red-50 border-red-200",
          label: "Critical Error",
        };
      case "warning":
        return {
          icon: AlertTriangle,
          badgeVariant: "warning" as const,
          color: "text-amber-700 bg-amber-50 border-amber-200",
          label: "Warning",
        };
      case "info":
        return {
          icon: Info,
          badgeVariant: "info" as const,
          color: "text-blue-700 bg-blue-50 border-blue-200",
          label: "Info Notice",
        };
    }
  };

  const renderIssueGroup = (
    title: string,
    groupIssues: Issue[],
    severity: IssueSeverity
  ) => {
    if (groupIssues.length === 0) return null;
    const meta = getSeverityMeta(severity);
    const Icon = meta.icon;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Icon
              className={cn(
                "h-4 w-4",
                severity === "critical"
                  ? "text-red-600"
                  : severity === "warning"
                  ? "text-amber-600"
                  : "text-blue-600"
              )}
            />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {title}
            </h4>
          </div>
          <Badge variant={meta.badgeVariant} className="text-[11px] font-semibold">
            {groupIssues.length}
          </Badge>
        </div>

        <Accordion type="multiple" className="space-y-2 border-none">
          {groupIssues.map((issue) => (
            <AccordionItem
              key={issue.id}
              value={issue.id}
              className={cn(
                "rounded-xl border px-3.5 py-1 transition-all bg-white shadow-2xs hover:shadow-xs",
                severity === "critical"
                  ? "border-red-200/80 hover:border-red-300"
                  : severity === "warning"
                  ? "border-amber-200/80 hover:border-amber-300"
                  : "border-blue-200/80 hover:border-blue-300"
              )}
            >
              <AccordionTrigger className="hover:no-underline py-2.5">
                <div className="flex items-start gap-2.5 text-left min-w-0 pr-2">
                  <span
                    className={cn(
                      "mt-0.5 inline-block h-2 w-2 rounded-full shrink-0",
                      severity === "critical"
                        ? "bg-red-500"
                        : severity === "warning"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                    )}
                  />
                  <div>
                    <h5 className="text-xs font-semibold text-slate-900 leading-snug">
                      {issue.title}
                    </h5>
                    {issue.field_name && (
                      <span className="text-[10px] font-medium text-slate-500 font-mono">
                        Target Field: {issue.field_name}
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="pt-1 pb-3 text-xs space-y-3">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 leading-relaxed">
                  {issue.description}
                </div>

                {issue.suggestion && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-emerald-800 text-[11.5px]">
                    <Lightbulb className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-emerald-900 block mb-0.5">
                        AI Suggested Fix:
                      </span>
                      {issue.suggestion}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                  <span className="flex items-center gap-1 font-mono">
                    <FileSearch className="h-3 w-3" />
                    Source: {issue.source}
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {issue.category.replace("_", " ")}
                  </Badge>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <CardTitle className="text-base font-semibold text-slate-900">
              Audit & Rule Violations
            </CardTitle>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic math verification and AI contradiction analysis
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {criticalIssues.length > 0 && (
            <Badge variant="destructive" className="text-xs font-semibold">
              {criticalIssues.length} Critical
            </Badge>
          )}
          {warningIssues.length > 0 && (
            <Badge variant="warning" className="text-xs font-semibold">
              {warningIssues.length} Warning
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-1 overflow-y-auto space-y-6">
        {issues.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
            <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="font-semibold text-sm text-slate-900">
              No Violations Found!
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              All mathematical formulas, panel texts, and regulatory rules matched cleanly.
            </p>
          </div>
        ) : (
          <>
            {renderIssueGroup("Critical Math & Legal Blockers", criticalIssues, "critical")}
            {renderIssueGroup("Warnings & Discrepancies", warningIssues, "warning")}
            {renderIssueGroup("Informational Notes & ERP Sync", infoIssues, "info")}
          </>
        )}
      </CardContent>
    </Card>
  );
}
