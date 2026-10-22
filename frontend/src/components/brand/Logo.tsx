import { cn } from "@/lib/utils";

/** The mark: a carbon set seen from the corner, a white top sheet over canary and sky copies. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden className={cn("h-7 w-7 shrink-0", className)}>
      <rect x="8.5" y="8.5" width="17" height="17" rx="3.5" fill="#A6C8FF" stroke="#15182B" strokeWidth="1.5" />
      <rect x="5.25" y="5.25" width="17" height="17" rx="3.5" fill="#FFE066" stroke="#15182B" strokeWidth="1.5" />
      <rect x="2" y="2" width="17" height="17" rx="3.5" fill="#FFFFFF" stroke="#15182B" strokeWidth="1.5" />
      <path d="M6 8h9M6 11.5h6M6 15h7.5" stroke="#15182B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <LogoMark className={size === "lg" ? "h-8 w-8" : undefined} />
      <span className={cn("heading inline-flex items-center gap-1.5 leading-none tracking-[-0.02em]", size === "lg" ? "text-[22px]" : "text-[19px]")}>
        PackProof
        <span
          aria-hidden
          className="rounded-[5px] bg-canary px-1.5 py-[3px] text-[0.62em] font-bold leading-none tracking-[0.04em] text-ink ring-1 ring-ink"
        >
          AI
        </span>
        <span className="sr-only">AI</span>
      </span>
    </span>
  );
}
