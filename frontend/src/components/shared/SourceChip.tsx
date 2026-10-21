"use client";

import { Crosshair, Flag as FlagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceRef } from "@/lib/types";
import { useBriefStore } from "@/store/briefStore";

export function sourceLabel(s: SourceRef): string {
  const panel = s.panel ? s.panel.replace(/_/g, " ") : `page ${s.page ?? 1}`;
  if (s.kind === "pdf") return `Artwork · ${panel}`;
  if (s.kind === "excel") return `Sheet · ${s.cell ?? s.sheet ?? ""}`;
  if (s.kind === "user") return "Reviewer";
  if (s.kind === "ai") return `AI vision · ${s.panel ? panel : "artwork"}`;
  if (s.kind === "word") return `Doc · ${s.cell ?? ""}`;
  if (s.kind === "text") return `Notes · ${s.cell ?? ""}`;
  return s.file;
}

/** One proof reference, printed like a code line. Located sources highlight the artwork. */
export function SourceChip({ source, label }: { source: SourceRef; label?: string }) {
  const setHighlight = useBriefStore((s) => s.setHighlight);
  const locatable = Boolean(source.bbox);
  const title = [source.file, source.snippet && `“${source.snippet}”`, source.note && `Note: ${source.note}`]
    .filter(Boolean)
    .join("\n");
  const body = (
    <>
      {locatable && <Crosshair aria-hidden className="h-3 w-3 shrink-0" />}
      <span className="truncate">{sourceLabel(source)}</span>
      {source.flagged && <FlagIcon aria-label="marked uncertain by the source" className="h-3 w-3 shrink-0 fill-canary text-canary-deep" />}
    </>
  );
  const cls = cn(
    "inline-flex max-w-full items-center gap-1 text-[12px] font-medium tabular-nums",
    source.kind === "ai" ? "text-ink-2" : source.kind === "user" ? "text-mint-deep" : "text-ink-muted"
  );
  if (!locatable) {
    return (
      <span className={cls} title={title}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        setHighlight({ label: label ?? sourceLabel(source), sources: [source] });
      }}
      className={cn(cls, "rounded-sm underline decoration-ink/30 decoration-dotted decoration-1 underline-offset-[3px] transition-colors hover:text-ink hover:decoration-solid hover:decoration-ink")}
    >
      {body}
    </button>
  );
}

/** A row of sources separated like a printed code line. */
export function SourceLine({ sources, label, className }: { sources: SourceRef[]; label?: string; className?: string }) {
  if (!sources.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {sources.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-[12px] text-line-strong">/</span>}
          <SourceChip source={s} label={label} />
        </span>
      ))}
    </div>
  );
}
