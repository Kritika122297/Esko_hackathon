"use client";

import Link from "next/link";
import { ArrowRight, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { ReadinessBar } from "@/components/ui/ReadinessBar";
import { Stamp } from "@/components/shared/badges";
import { api } from "@/lib/api";
import { BriefState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

/** Brief readiness as one strip across the page: the score, where the fields stand, and the finalize gate. */
export function ReadinessCard({ state }: { state: BriefState }) {
  const { run, busy } = useBriefStore();
  const r = state.readiness;
  if (!r) return null;
  const finalized = state.status === "finalized";
  const owners = Array.from(
    new Set(state.issues.filter((i) => i.state === "open" && i.resolution === "data" && i.severity === "blocking").map((i) => i.owner))
  );
  const total = Math.max(r.fields_total, 1);

  return (
    <section
      aria-label="Brief readiness"
      className={cn(
        "sheet grid grid-cols-1 gap-x-8 gap-y-4 overflow-hidden border-l-[4px] px-5 py-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(250px,auto)] lg:items-center",
        finalized || r.ready ? "border-l-mint-deep" : "border-l-canary-deep"
      )}
    >
      <div className="flex items-center gap-4">
        <RollingNumber value={r.score} className="text-[56px] text-ink" suffix={<span className="ml-0.5 text-[26px] leading-none">%</span>} label={`Brief readiness ${r.score} percent`} />
        <div className="min-w-0">
          <h2 className="heading text-[18px] leading-tight text-ink">{finalized ? "Finalized" : r.ready ? "Ready for handoff" : "Not ready yet"}</h2>
          <p className="mt-0.5 max-w-[34ch] text-[13px] leading-snug text-ink-muted">
            {!r.ready && owners.length > 0 ? `Waiting on ${owners.join(", ")}.` : r.headline}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <ReadinessBar className="h-2.5" confirmed={r.fields_confirmed / total} review={r.fields_needs_review / total} />
        <dl className="mt-2.5 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          {(
            [
              [r.fields_confirmed, "confirmed"],
              [r.fields_needs_review, "to review"],
              [r.fields_missing, "missing"],
            ] as const
          ).map(([n, label]) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <dt className="sr-only">{label}</dt>
              <dd className="figure text-[24px] text-ink">{n}</dd>
              <dd className="text-[13px] text-ink-muted" aria-hidden>
                {label}
              </dd>
            </div>
          ))}
          {r.warnings_open > 0 && (
            <div className="text-[12.5px] text-ink-muted" title="Warnings do not block">
              {r.warnings_open} {r.warnings_open === 1 ? "warning" : "warnings"} open
            </div>
          )}
        </dl>
      </div>

      <div className="space-y-2" title="Blocking items must be answered or passed to the agency as open questions. Designer tasks never block.">
        {finalized ? (
          <>
            <Button asChild className="w-full" size="lg">
              <Link href="/export">
                Open designer brief <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center justify-between gap-2">
              <Stamp tone="ok" tilt={-3} landed={state.status}>
                Finalized
              </Stamp>
              <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => run("Reopening", (sid) => api.reopen(sid), "Brief reopened")}>
                <LockOpen className="h-3.5 w-3.5" /> Reopen for edits
              </Button>
            </div>
          </>
        ) : r.ready ? (
          <Button variant="canary" size="lg" className="w-full" disabled={!!busy} onClick={() => run("Finalizing", (sid) => api.finalize(sid), "Brief finalized")}>
            <Lock className="h-4 w-4" /> Finalize brief
          </Button>
        ) : (
          <>
            <Button variant="soft" size="lg" className="w-full" disabled>
              <Lock className="h-4 w-4" /> Finalize locked ({r.blocking_open} blocking)
            </Button>
            <p className="text-center text-[12px] text-ink-muted">Answer or pass on the blocking items to unlock.</p>
          </>
        )}
      </div>
    </section>
  );
}
