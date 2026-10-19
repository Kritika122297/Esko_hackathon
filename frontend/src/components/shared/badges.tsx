import { cn } from "@/lib/utils";
import { DesignAction, FieldStatus, IssueKind, Severity } from "@/lib/types";

type Tone = "review" | "stop" | "ok" | "outline" | "ink" | "muted";

const TONE: Record<Tone, string> = {
  review: "bg-talker text-ink",
  stop: "bg-stop text-white",
  ok: "bg-ok text-white",
  ink: "bg-ink text-white",
  outline: "bg-stock text-ink shadow-[inset_0_0_0_1px_#121514]",
  muted: "bg-ground text-ink-muted shadow-[inset_0_0_0_1px_#AEB4A9]",
};

/** Notched talker flag. `side` is where the notch points from: "left" hangs off a right edge. */
export function Flag({
  tone,
  children,
  side = "left",
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}) {
  return <span className={cn("flag", side === "right" && "flag-right", TONE[tone], className)}>{children}</span>;
}

export function StatusFlag({ status, className }: { status: FieldStatus; className?: string }) {
  const map: Record<FieldStatus, [Tone, string]> = {
    confirmed: ["ok", "OK"],
    needs_review: ["review", "Review"],
    missing: ["outline", "Missing"],
  };
  const [tone, text] = map[status];
  return (
    <Flag tone={tone} className={className}>
      {text}
    </Flag>
  );
}

export function SeverityFlag({ severity, className }: { severity: Severity; className?: string }) {
  const map: Record<Severity, [Tone, string]> = {
    blocking: ["stop", "Blocking"],
    warning: ["review", "Warning"],
    info: ["muted", "Info"],
  };
  const [tone, text] = map[severity];
  return (
    <Flag tone={tone} side="right" className={className}>
      {text}
    </Flag>
  );
}

export const KIND_TEXT: Record<IssueKind, string> = {
  definite: "Definite error",
  likely: "Likely problem",
  needs_human: "Needs human check",
};

export function KindLabel({ kind, ai }: { kind: IssueKind; ai?: boolean }) {
  return (
    <span className="text-xs text-ink-muted">
      {KIND_TEXT[kind]}
      {ai && <span className="text-ink-faint"> · AI suggestion</span>}
    </span>
  );
}

export function OwnerTag({ owner, className }: { owner: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded border border-ink px-1.5 text-[11px] tabular-nums font-semibold", className)}>
      {owner}
    </span>
  );
}

export const ACTION_META: Record<DesignAction, { text: string; tone: Tone; cls: string }> = {
  change: { text: "Change", tone: "ink", cls: "bg-ink text-white" },
  add: { text: "Add", tone: "ok", cls: "bg-ok text-white" },
  remove: { text: "Remove", tone: "stop", cls: "bg-stop text-white" },
  unknown: { text: "Unknown", tone: "review", cls: "bg-talker text-ink" },
  keep: { text: "Keep", tone: "outline", cls: "bg-stock text-ink shadow-[inset_0_0_0_1px_#121514]" },
};

export function ActionFlag({ action, className }: { action: DesignAction; className?: string }) {
  const m = ACTION_META[action] ?? ACTION_META.unknown;
  return (
    <Flag tone={m.tone} side="right" className={className}>
      {m.text}
    </Flag>
  );
}
