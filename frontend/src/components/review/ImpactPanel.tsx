"use client";

import { ArrowRight, MapPin, Users } from "lucide-react";
import { ImpactPreview } from "@/lib/types";
import { Flag } from "@/components/shared/badges";
import { SourceChip } from "@/components/shared/SourceChip";

/** Change Impact Simulator: what a change would resolve or introduce, before it is saved. */
export function ImpactPanel({ p }: { p: ImpactPreview }) {
  const places = [...p.artwork_locations, ...p.sheet_locations];
  return (
    <div className="anim-rise space-y-3 rounded border border-line-strong bg-ground p-3 text-xs text-ink-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-bold text-ink">
          If “{p.old ?? "empty"}” becomes “{p.new}”
        </p>
        <p className="flex items-baseline gap-3 text-ink-muted">
          <span>
            Readiness <b className="figure text-[18px] text-ink">{p.readiness_before}%</b>
            <ArrowRight className="mx-1 inline h-3 w-3" />
            <b className="figure text-[18px] text-ink">{p.readiness_after}%</b>
          </span>
          <span>
            Blocking <b className="figure text-[18px] text-ink">{p.blocking_before}</b>
            <ArrowRight className="mx-1 inline h-3 w-3" />
            <b className="figure text-[18px] text-ink">{p.blocking_after}</b>
          </span>
        </p>
      </div>
      {p.resolved.length > 0 && (
        <div className="flex items-start gap-2">
          <Flag tone="ok" side="right" className="mt-0.5 shrink-0">Resolves</Flag>
          <ul className="space-y-0.5">{p.resolved.map((i) => <li key={i.id}>{i.title}</li>)}</ul>
        </div>
      )}
      {p.introduced.length > 0 && (
        <div className="flex items-start gap-2">
          <Flag tone="stop" side="right" className="mt-0.5 shrink-0">New</Flag>
          <ul className="space-y-0.5">{p.introduced.map((i) => <li key={i.id}>{i.title}</li>)}</ul>
        </div>
      )}
      {p.resolved.length === 0 && p.introduced.length === 0 && <p>No finding would open or close.</p>}
      {p.status_changes.length > 0 && (
        <p className="text-ink-muted">
          Field status: {p.status_changes.map((c) => `${c.label} ${c.before.replace("_", " ")} → ${c.after.replace("_", " ")}`).join(" · ")}
        </p>
      )}
      {places.length > 0 && (
        <div>
          <p className="flex items-center gap-1 font-semibold text-ink">
            <MapPin className="h-3 w-3" /> The old value also appears here, update these too
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {places.map((s, i) => (
              <SourceChip key={i} source={s} label={`Old value: ${p.old}`} />
            ))}
          </div>
        </div>
      )}
      <p className="flex items-center gap-1 text-ink-muted">
        <Users className="h-3 w-3" /> Approval needed from <b className="text-ink">{p.approvals_needed.join(", ")}</b>
      </p>
    </div>
  );
}
