"use client";

import Link from "next/link";
import { ArrowRight, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { BriefState } from "@/lib/types";
import { useBriefStore } from "@/store/briefStore";

/** Brief readiness, set like a shelf price on the green strip, with the finalize gate. */
export function ReadinessCard({ state }: { state: BriefState }) {
  const { run, busy } = useBriefStore();
  const r = state.readiness;
  if (!r) return null;
  const finalized = state.status === "finalized";
  const owners = Array.from(
    new Set(state.issues.filter((i) => i.state === "open" && i.resolution === "data" && i.severity === "blocking").map((i) => i.owner))
  );
  const pct = (n: number) => `${(n / Math.max(r.fields_total, 1)) * 100}%`;

  return (
    <section aria-label="Brief readiness" className="on-rail rounded bg-rail p-4 text-white shadow-ticket">
      <div className="flex items-start justify-between gap-3">
        <h2 className="pt-1 text-[19px] font-bold leading-tight">{finalized ? "Finalized" : r.ready ? "Ready for handoff" : "Not ready"}</h2>
        <div className="text-right">
          <p className="figure flex items-start justify-end text-[76px] text-white" aria-label={`Brief readiness ${r.score} percent`}>
            {r.score}
            <span className="ml-0.5 mt-1 text-[30px] leading-none">%</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/65">brief readiness</p>
        </div>
      </div>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-sm bg-white/15" aria-hidden>
        <div className="bg-talker transition-[width] duration-700 ease-out" style={{ width: pct(r.fields_confirmed) }} />
        <div className="bg-white/35 transition-[width] duration-700 ease-out" style={{ width: pct(r.fields_needs_review) }} />
      </div>
      <p className="meta mt-1.5 text-white/70">
        {r.fields_confirmed} confirmed · {r.fields_needs_review} to review · {r.fields_missing} missing
      </p>
      <p className="mt-3 text-[13px] leading-snug">{r.headline}</p>
      {!r.ready && owners.length > 0 && <p className="mt-1 text-[13px] text-white/75">Waiting on {owners.join(", ")}.</p>}
      {r.warnings_open > 0 && <p className="mt-1 text-xs text-white/70">{r.warnings_open} {r.warnings_open === 1 ? "warning is" : "warnings are"} open; warnings do not block.</p>}

      <div className="mt-4 space-y-2">
        {finalized ? (
          <>
            <Button asChild variant="talker" className="w-full">
              <Link href="/export">
                Open designer brief <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="onRail" size="sm" className="w-full" disabled={!!busy} onClick={() => run("Reopening", (sid) => api.reopen(sid), "Brief reopened")}>
              <LockOpen className="h-3.5 w-3.5" /> Reopen for edits
            </Button>
          </>
        ) : r.ready ? (
          <Button variant="talker" className="w-full" disabled={!!busy} onClick={() => run("Finalizing", (sid) => api.finalize(sid), "Brief finalized")}>
            <Lock className="h-4 w-4" /> Finalize brief
          </Button>
        ) : (
          <Button variant="onRail" className="w-full" disabled>
            <Lock className="h-4 w-4" /> Finalize locked ({r.blocking_open} blocking)
          </Button>
        )}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-white/60">
        Blocking items must be answered or passed to the agency as open questions. Designer tasks never block.
      </p>
    </section>
  );
}
