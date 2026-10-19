"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Upload,
  Search,
  HelpCircle,
  FileEdit,
  Download,
  CheckCircle2,
  Box,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";
import { WorkflowStep } from "@/lib/types";

interface NavItem {
  id: WorkflowStep;
  label: string;
  sublabel: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "upload",
    label: "Upload",
    sublabel: "Documents & Specs",
    href: "/upload",
    icon: Upload,
  },
  {
    id: "analysis",
    label: "Analysis",
    sublabel: "Extraction & Issues",
    href: "/analysis",
    icon: Search,
  },
  {
    id: "questions",
    label: "Questions",
    sublabel: "Clarify & Resolve",
    href: "/questions",
    icon: HelpCircle,
  },
  {
    id: "review",
    label: "Review",
    sublabel: "Edit & Audit Brief",
    href: "/review",
    icon: FileEdit,
  },
  {
    id: "export",
    label: "Export",
    sublabel: "DOCX & PDF Brief",
    href: "/export",
    icon: Download,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { completedSteps, sessionId, reset } = useBriefStore();

  const isStepAccessible = (itemIndex: number) => {
    if (itemIndex === 0) return true;
    const prevItem = NAV_ITEMS[itemIndex - 1];
    return completedSteps.includes(prevItem.id) || Boolean(sessionId);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-950 text-white flex flex-col border-r border-slate-800 z-40 select-none shadow-xl">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80">
        <Link href="/upload" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Box className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-white">
                BriefForge
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                AI
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Packaging Brief Assistant
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Workflow Pipeline
        </div>
        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const isCompleted = completedSteps.includes(item.id);
          const accessible = isStepAccessible(index);

          const content = (
            <div
              className={cn(
                "group flex items-center gap-3.5 px-3.5 py-3 rounded-lg text-sm font-medium transition-all relative",
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : accessible
                  ? "text-slate-300 hover:bg-slate-900 hover:text-white"
                  : "text-slate-500 cursor-not-allowed opacity-50"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isActive
                    ? "bg-blue-700 text-white"
                    : isCompleted
                    ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                    : "bg-slate-800 text-slate-400 group-hover:text-slate-200"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="truncate">{item.label}</span>
                  {isCompleted && !isActive && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  )}
                </div>
                <p
                  className={cn(
                    "text-[11px] truncate",
                    isActive ? "text-blue-100" : "text-slate-400"
                  )}
                >
                  {item.sublabel}
                </p>
              </div>

              {isActive && (
                <div className="absolute right-2 h-2 w-2 rounded-full bg-white shadow" />
              )}
            </div>
          );

          if (!accessible) {
            return (
              <div key={item.id} className="cursor-not-allowed">
                {content}
              </div>
            );
          }

          return (
            <Link key={item.id} href={item.href}>
              {content}
            </Link>
          );
        })}
      </div>

      {/* Footer Info & Session status */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60">
        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Session
            </span>
            <span className="text-slate-300 font-mono text-[11px]">
              {sessionId ? sessionId.substring(0, 10) : "Not started"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Deterministic check + AI rule validation enabled.
          </p>
        </div>

        <button
          onClick={() => {
            if (confirm("Reset current session and start over?")) {
              reset();
              window.location.href = "/upload";
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 rounded-md transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Workflow
        </button>
      </div>
    </aside>
  );
}
