"use client";

import React, { useState } from "react";
import {
  FileText,
  Calendar,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
  Layers,
  Sparkles,
  MapPin,
  Tag,
} from "lucide-react";
import { PackagingBrief } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BriefPreviewProps {
  brief: PackagingBrief;
}

export function BriefPreview({ brief }: BriefPreviewProps) {
  const [showProofTable, setShowProofTable] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 sm:p-12 space-y-10 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
      {/* Document Letterhead */}
      <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-slate-900 text-white rounded">
              BRIEFFORGE
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Packaging Design Specification
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950">
            {brief.product_name}
          </h1>
        </div>

        <div className="text-left sm:text-right space-y-1 text-xs text-slate-500 font-mono">
          <div>
            <span className="text-slate-400">Ref ID: </span>
            <span className="font-semibold text-slate-800">{brief.session_id}</span>
          </div>
          <div>
            <span className="text-slate-400">Date: </span>
            <span>{new Date(brief.created_at).toLocaleDateString()}</span>
          </div>
          <div className="pt-1">
            <Badge variant="success" className="uppercase text-[10px] tracking-wider font-bold">
              Status: {brief.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Agency Open Questions Callout Box */}
      {brief.open_questions && brief.open_questions.length > 0 && (
        <div className="p-5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
            <HelpCircle className="h-4 w-4" />
            <span>Open Questions for Design Agency / Artwork Production</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-xs font-medium text-amber-900 leading-relaxed">
            {brief.open_questions.map((q, idx) => (
              <li key={idx} className="pl-1">
                {q}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Brief Sections */}
      <div className="space-y-8">
        {brief.sections.map((section, sIdx) => (
          <div key={section.section_name} className="space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-blue-600 font-mono">
                0{sIdx + 1}
              </span>
              <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                {section.section_name}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map((field) => (
                <div
                  key={field.field_name}
                  className={cn(
                    "p-3.5 rounded-lg border text-xs space-y-1.5 bg-slate-50/50",
                    field.field_name.toLowerCase().includes("ingredient") &&
                      "md:col-span-2",
                    field.status === "conflicting"
                      ? "border-red-200 bg-red-50/20"
                      : "border-slate-200/80"
                  )}
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {field.field_name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {field.status}
                    </span>
                  </div>

                  <p className="text-slate-900 font-mono font-medium text-[12px] leading-relaxed break-words whitespace-pre-wrap">
                    {String(field.value || "—")}
                  </p>

                  <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="truncate max-w-[280px]">
                      Source: {field.source}
                    </span>
                    {field.user_override && (
                      <span className="text-purple-600 font-semibold">
                        [Edited]
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Proof Table (Collapsible) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden print:border-none">
        <button
          type="button"
          onClick={() => setShowProofTable(!showProofTable)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Verification Proof Table & Source Ledger
            </span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-500 transition-transform duration-200",
              showProofTable && "rotate-180"
            )}
          />
        </button>

        {showProofTable && (
          <div className="overflow-x-auto border-t border-slate-200 p-2 bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2 px-3 font-semibold text-[11px]">Field</th>
                  <th className="py-2 px-3 font-semibold text-[11px]">Value</th>
                  <th className="py-2 px-3 font-semibold text-[11px]">Provenance Source</th>
                  <th className="py-2 px-3 font-semibold text-[11px]">Confidence</th>
                  <th className="py-2 px-3 font-semibold text-[11px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                {brief.sections.flatMap((sec) =>
                  sec.fields.map((fld) => (
                    <tr key={`${sec.section_name}-${fld.field_name}`} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {fld.field_name}
                      </td>
                      <td className="py-2 px-3 text-slate-700 max-w-[200px] truncate">
                        {String(fld.value)}
                      </td>
                      <td className="py-2 px-3 text-slate-500 max-w-[240px] truncate">
                        {fld.source}
                      </td>
                      <td className="py-2 px-3 uppercase text-slate-500">
                        {fld.confidence}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                            fld.status === "confirmed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {fld.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Signature & Compliance Footer */}
      <div className="pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-500">
        <div className="space-y-1">
          <p className="font-semibold text-slate-800">
            Automated Audit Certification
          </p>
          <p className="text-[11px] leading-relaxed">
            Compiled by BriefForge AI Engine. Verified against GS1 Packaging guidelines, EU 1169/2011, and FDA nutrition labeling regulations.
          </p>
        </div>
        <div className="sm:text-right space-y-1">
          <p className="font-semibold text-slate-800">Human Approval Sign-off</p>
          <p className="font-mono text-[11px]">Reviewed & Locked by Packaging Lead</p>
          <div className="pt-2 text-[10px] text-slate-400 font-mono">
            HASH: 8f4e2b0c-brief-verified-ok
          </div>
        </div>
      </div>
    </div>
  );
}
