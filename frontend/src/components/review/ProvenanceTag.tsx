"use client";

import React from "react";
import {
  FileText,
  FileSpreadsheet,
  Sparkles,
  UserCheck,
  FileCode,
  Layers,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ProvenanceTagProps {
  source: string;
  isOverride?: boolean;
}

export function ProvenanceTag({ source, isOverride = false }: ProvenanceTagProps) {
  const s = source.toLowerCase();

  const getSourceMeta = () => {
    if (isOverride) {
      return {
        icon: UserCheck,
        label: "User Override",
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        type: "Manual Human Override",
      };
    }
    if (s.includes("pdf")) {
      return {
        icon: FileText,
        label: source.length > 24 ? source.substring(0, 22) + "..." : source,
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        type: "PDF Document Extraction",
      };
    }
    if (s.includes("excel") || s.includes("xlsx") || s.includes("cell")) {
      return {
        icon: FileSpreadsheet,
        label: source.length > 24 ? source.substring(0, 22) + "..." : source,
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        type: "Excel Cell Formula Extraction",
      };
    }
    if (s.includes("docx") || s.includes("word")) {
      return {
        icon: FileCode,
        label: source.length > 24 ? source.substring(0, 22) + "..." : source,
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        type: "Word Brand Guidelines Extraction",
      };
    }
    if (s.includes("ai") || s.includes("inferred")) {
      return {
        icon: Sparkles,
        label: "AI Inferred",
        bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
        type: "AI Model Structural Inference",
      };
    }
    return {
      icon: Layers,
      label: source.length > 24 ? source.substring(0, 22) + "..." : source,
      bg: "bg-slate-50 text-slate-700 border-slate-200",
      type: "Extracted Reference",
    };
  };

  const meta = getSourceMeta();
  const Icon = meta.icon;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono cursor-help transition-colors select-none",
              meta.bg
            )}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[150px]">{meta.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="space-y-1">
          <p className="font-semibold text-xs text-white">{meta.type}</p>
          <p className="text-[11px] text-slate-300 font-mono leading-tight">
            {source}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
