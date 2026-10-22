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

/** Brief readiness on the top sheet of the set, with the finalize gate. */
export function ReadinessCard({ state }: { state: BriefState }) {
  const { run, busy } = useBriefStore();
  const r = state.readiness;
  if (!r) return null;
  const finalized = state.status === "finalized";
  const owners = Array.from(
    new Set(state.issues.filter((i) => i.state === "open" && i.resolution === "data" && i.severity === "blocking").map((i) => i.owner))
  );
  const total = Math.max(r.fields_total, 1);
  const tone = finalized || r.ready ? "[--copy-1:#DDF3E4] [--copy-2:#E0ECFF]" : "[--copy-1:#FFF5C2] [--copy-2:#FFE4E7]";

  return (
    <section aria-label="Brief readiness" className={cn("sheet-set mb-2.5 mr-2.5 p-5", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pt-1">
          <h2 className="heading text-[19px] text-ink">{finalized ? "Finalized" : r.ready ? "Ready for handoff" : "Not ready yet"}</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">brief readiness</p>
        </div>
        <RollingNumber value={r.score} className="text-[68px] text-ink" suffix={<span className="ml-0.5 text-[30px] leading-none">%</span>} label={`Brief readiness ${r.score} percent`} />
      </div>
      <ReadinessBar className="mt-4 h-2" confirmed={r.fields_confirmed / total} review={r.fields_needs_review / total} />
      <dl className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {(
          [
            [r.fields_confirmed, "confirmed"],
            [r.fields_needs_review, "to review"],
            [r.fields_missing, "missing"],
          ] as const
        ).map(([n, label]) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <dt className="sr-only">{label}</dt>
            <dd className="figure text-[22px] text-ink">{n}</dd>
            <dd className="text-[12.5px] text-ink-muted" aria-hidden>
              {label}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[13.5px] leading-snug text-ink">{r.headline}</p>
      {!r.ready && owners.length > 0 && <p className="mt-1.5 text-[13px] text-ink-muted">Waiting on {owners.join(", ")}.</p>}
      {r.warnings_open > 0 && (
        <p className="mt-1 text-[12.5px] text-ink-muted">
          {r.warnings_open} {r.warnings_open === 1 ? "warning is" : "warnings are"} open; warnings do not block.
        </p>
      )}

      <div className="mt-5 space-y-2">
        {finalized ? (
          <>
            <div className="flex justify-center py-1">
              <Stamp tone="ok" size="lg" tilt={-4} landed={state.status}>
                Finalized
              </Stamp>
            </div>
            <Button asChild className="w-full" size="lg">
              <Link href="/export">
                Open designer brief <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="w-full" disabled={!!busy} onClick={() => run("Reopening", (sid) => api.reopen(sid), "Brief reopened")}>
              <LockOpen className="h-3.5 w-3.5" /> Reopen for edits
            </Button>
          </>
        ) : r.ready ? (
          <Button variant="canary" size="lg" className="w-full" disabled={!!busy} onClick={() => run("Finalizing", (sid) => api.finalize(sid), "Brief finalized")}>
            <Lock className="h-4 w-4" /> Finalize brief
          </Button>
        ) : (
          <Button variant="soft" size="lg" className="w-full" disabled>
            <Lock className="h-4 w-4" /> Finalize locked ({r.blocking_open} blocking)
          </Button>
        )}
      </div>
      <p className="mt-3 text-[12px] leading-snug text-ink-muted">Blocking items must be answered or passed to the agency as open questions. Designer tasks never block.</p>
    </section>
  );
}
