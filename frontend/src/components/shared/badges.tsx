"use client";

import { Check, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { DesignAction, FieldStatus, IssueKind, Severity, categoryLabel } from "@/lib/types";
import { useChangeKey } from "./useChangeKey";

export type Tone = "review" | "stop" | "ok" | "gap" | "ink" | "muted" | "sky" | "gold" | "slate";

const TONE: Record<Tone, string> = {
  review: "text-canary-deep bg-canary-soft",
  stop: "text-stop-deep bg-stop-soft",
  ok: "text-mint-deep bg-mint-soft",
  sky: "text-sky-deep bg-sky-soft",
  gold: "text-gold-deep bg-gold-soft",
  slate: "text-ink-2 bg-desk-2",
  ink: "text-ink bg-paper",
  muted: "text-ink-muted bg-desk",
  // A missing value is a tagged gap: a dashed outline with a word in it, never a blank
  gap: "text-ink-2 bg-paper [border-style:dashed]",
};

/**
 * A stamp: a state is always a word in a bordered impression. `landed` replays the stamp
 * coming down whenever its value changes after the first render.
 */
export function Stamp({
  tone,
  children,
  className,
  size = "md",
  landed,
  tilt = 0,
  title,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
  /** A signature (for example the status) whose change makes the stamp land again. */
  landed?: string;
  tilt?: number;
  title?: string;
}) {
  const key = useChangeKey(landed ?? "");
  return (
    <span
      key={key}
      title={title}
      className={cn("stamp", size === "lg" && "stamp-lg", TONE[tone], key > 0 && "anim-stamp", className)}
      style={tilt ? ({ "--stamp-r": `${tilt}deg`, transform: `rotate(${tilt}deg)` } as React.CSSProperties) : undefined}
    >
      {children}
    </span>
  );
}

export const STATUS_META: Record<FieldStatus, { tone: Tone; text: string }> = {
  confirmed: { tone: "ok", text: "Confirmed" },
  needs_review: { tone: "review", text: "Review" },
  missing: { tone: "gap", text: "Missing" },
};

export function StatusStamp({ status, className, size }: { status: FieldStatus; className?: string; size?: "md" | "lg" }) {
  const m = STATUS_META[status];
  return (
    <Stamp tone={m.tone} landed={status} className={className} size={size}>
      {status === "confirmed" && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
      {m.text}
    </Stamp>
  );
}

export const SEVERITY_META: Record<Severity, { tone: Tone; text: string }> = {
  blocking: { tone: "stop", text: "Blocking" },
  warning: { tone: "gold", text: "Warning" },
  info: { tone: "muted", text: "Info" },
};

export function SeverityStamp({ severity, className }: { severity: Severity; className?: string }) {
  const m = SEVERITY_META[severity];
  return (
    <Stamp tone={m.tone} className={className}>
      {m.text}
    </Stamp>
  );
}

export const KIND_TEXT: Record<IssueKind, string> = {
  definite: "Definite error",
  likely: "Likely problem",
  needs_human: "Needs human check",
};

export function KindLabel({ kind, ai }: { kind: IssueKind; ai?: boolean }) {
  return (
    <span className="text-[12.5px] font-medium text-ink-muted">
      {KIND_TEXT[kind]}
      {ai && <span className="text-ink-faint"> · AI suggestion</span>}
    </span>
  );
}

/** Market code as a small ink plate; 'EU → US' for a brief adapted from another market. */
export function MarketChip({ market, from, className }: { market: string; from?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm bg-ink px-1.5 text-[12px] font-bold uppercase tracking-[0.04em] text-white [font-family:var(--font-display)] [font-variation-settings:'wdth'_80]",
        className
      )}
      title={from ? `Adapted from the ${from} brief for ${market}` : `Market: ${market}`}
    >
      {from ? `${from} → ${market}` : market}
    </span>
  );
}

/** Product category as a quiet tag; nothing when there is none. */
export function CategoryChip({ category, className }: { category?: string | null; className?: string }) {
  const label = categoryLabel(category);
  if (!label) return null;
  return <span className={cn("inline-flex h-6 items-center rounded-sm bg-desk px-2 text-[12px] font-semibold text-ink-2", className)}>{label}</span>;
}

/** Who the item is routed to. */
export function OwnerTag({ owner, className }: { owner: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-sm border border-line-strong bg-paper px-1.5 text-[12px] font-semibold text-ink-2", className)}
      title={`Routed to ${owner}`}
    >
      <Route className="h-3 w-3 text-ink-faint" aria-hidden />
      {owner}
    </span>
  );
}

export const ACTION_META: Record<DesignAction, { text: string; tone: Tone; cls: string }> = {
  change: { text: "Change", tone: "ink", cls: "bg-ink text-white" },
  add: { text: "Add", tone: "ok", cls: "bg-mint-deep text-white" },
  remove: { text: "Remove", tone: "slate", cls: "bg-ink-muted text-white" },
  unknown: { text: "Unknown", tone: "review", cls: "bg-canary text-ink" },
  keep: { text: "Keep", tone: "muted", cls: "bg-paper text-ink shadow-[inset_0_0_0_1px_#15182B]" },
};

export function ActionStamp({ action, className }: { action: DesignAction; className?: string }) {
  const m = ACTION_META[action] ?? ACTION_META.unknown;
  return (
    <Stamp tone={m.tone} className={className}>
      {m.text}
    </Stamp>
  );
}
