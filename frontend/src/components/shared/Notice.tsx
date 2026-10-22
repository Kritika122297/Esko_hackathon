"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check, FolderOpen, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/shared/badges";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

export function ErrorBanner() {
  const { error, errorDetail, clearError } = useBriefStore();
  if (!error) return null;
  const blocking = (errorDetail as any)?.blocking as { id: string; title: string }[] | undefined;
  return (
    <div role="alert" className="anim-rise flex items-start justify-between gap-3 rounded-lg border border-stop/30 bg-stop-soft px-4 py-3 text-sm">
      <div className="flex min-w-0 items-start gap-3">
        <Stamp tone="stop" className="mt-0.5 bg-paper">
          Problem
        </Stamp>
        <div className="min-w-0">
          <p className="font-semibold text-ink [overflow-wrap:anywhere]">{error}</p>
          {blocking && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
              {blocking.map((b) => (
                <li key={b.id}>{b.title}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <button onClick={clearError} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-stop/10 hover:text-ink" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function useElapsed(since: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since ? Math.max(0, Math.round((now - since) / 1000)) : 0;
}

export function fmtElapsed(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Bottom-right status: what is running (with real elapsed time), then a short confirmation.
 * On phones it spans the width at the foot of the screen.
 */
export function BusyToast() {
  const { busy, busySince, notice, clearNotice } = useBriefStore();
  const elapsed = useElapsed(busySince);
  const pathname = usePathname();
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 2400);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  // The upload page shows its own progress (the Autopilot timeline with its clock), so no second timer here.
  if (pathname === "/upload") return null;
  if (!busy && !notice) return null;
  return (
    <div role="status" aria-live="polite" className="no-print fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6">
      {busy ? (
        <div className="anim-toast w-full overflow-hidden rounded-lg bg-ink text-white shadow-lift sm:w-80">
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13.5px] font-semibold">
            <span className="min-w-0 truncate">{busy}…</span>
            <span className="figure text-[18px] text-white/75">{fmtElapsed(elapsed)}</span>
          </div>
          <div className="h-[3px] bg-white/10">
            <div className="scan-bar h-full w-1/4 rounded-full bg-canary" />
          </div>
        </div>
      ) : (
        <div className="anim-toast flex items-center gap-3 rounded-lg border border-line bg-paper py-2.5 pl-3 pr-4 text-[13.5px] font-semibold text-ink shadow-lift">
          <span className="anim-stamp grid h-6 w-6 place-items-center rounded-full bg-mint-soft text-mint-deep">
            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          </span>
          {notice}
        </div>
      )}
    </div>
  );
}

export function NoSession() {
  const loadError = useBriefStore((s) => s.loadError);
  if (loadError) return <LoadFailed />;
  return (
    <div className="anim-rise mx-auto mt-10 max-w-lg">
      <div className="sheet-set p-8 text-center sm:p-10">
        <h1 className="heading text-[26px] text-ink">No brief open</h1>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-ink-muted">
          Start from the product files, or open an existing brief from Projects. PackProofAI reads, fills and checks it for you.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button asChild size="lg">
            <Link href="/upload">
              Create a brief <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/projects">
              <FolderOpen className="h-4 w-4" /> Projects
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Shown when a brief could not be opened (backend down, server error); "not found" shows NoSession instead. */
export function LoadFailed() {
  const { loadError, load, busy } = useBriefStore();
  if (!loadError) return null;
  return (
    <div role="alert" className="sheet anim-rise mx-auto mt-10 max-w-lg p-8">
      <Stamp tone="stop" size="lg" tilt={-2}>
        Problem
      </Stamp>
      <h1 className="heading mt-4 text-[24px] text-ink">The brief could not be opened</h1>
      <p className="mt-2 break-words text-sm text-ink-2">{loadError.message}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => load(loadError.id)} disabled={busy === "Loading brief"}>
          <RotateCcw className="h-4 w-4" /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/projects">All projects</Link>
        </Button>
      </div>
    </div>
  );
}

/** While the open brief is not in memory yet: a loading shape, or the failure with a retry. */
export function SessionPending({ what = "brief" }: { what?: string }) {
  const loadError = useBriefStore((s) => s.loadError);
  return loadError ? <LoadFailed /> : <Loading what={what} />;
}

export function PageHead({ title, lead, actions, className }: { title: string; lead?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col justify-between gap-4 md:flex-row md:items-end", className)}>
      <div className="min-w-0">
        <h1 className="heading text-[30px] text-ink md:text-[34px]">{title}</h1>
        {lead && <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-ink-muted">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Loading: the shape of what is coming, so the page does not jump when it lands. */
export function Loading({ what = "brief", rows = 3 }: { what?: string; rows?: number }) {
  return (
    <div className="mt-2 space-y-3" role="status" aria-live="polite">
      <span className="sr-only">Loading {what}…</span>
      <div aria-hidden className="h-8 w-56 rounded-md skeleton" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} aria-hidden className="sheet flex items-center gap-4 p-4" style={{ opacity: 1 - i * 0.22 }}>
          <div className="h-10 w-10 shrink-0 rounded-md skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/5 rounded skeleton" />
            <div className="h-3 w-3/5 rounded skeleton" />
          </div>
          <div className="hidden h-8 w-24 rounded-md skeleton sm:block" />
        </div>
      ))}
    </div>
  );
}
