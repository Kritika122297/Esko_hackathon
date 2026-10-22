import { cn } from "@/lib/utils";

/**
 * Confirmed and to-review shares of the brief as one bar. Segments move with transforms only
 * (scaleX for length, translateX for position), so a change in readiness never re-lays out the page.
 */
export function ReadinessBar({ confirmed, review, className }: { confirmed: number; review: number; className?: string }) {
  const a = Math.max(0, Math.min(1, confirmed));
  const b = Math.max(0, Math.min(1 - a, review));
  return (
    <div className={cn("relative h-1.5 overflow-hidden rounded-full bg-desk-2", className)} aria-hidden>
      <div className="absolute inset-0 origin-left bg-mint-deep transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${a})` }} />
      <div
        className="absolute inset-0 origin-left bg-canary transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${a * 100}%) scaleX(${b})` }}
      />
    </div>
  );
}
