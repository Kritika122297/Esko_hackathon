"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/shared/badges";
import { useBriefStore } from "@/store/briefStore";

export function ErrorBanner() {
  const { error, errorDetail, clearError } = useBriefStore();
  if (!error) return null;
  const blocking = (errorDetail as any)?.blocking as { id: string; title: string }[] | undefined;
  return (
    <div role="alert" className="ticket anim-rise flex items-start justify-between gap-3 border-stop/40 bg-stop-soft p-3 pl-0 text-sm">
      <div className="flex items-start gap-3">
        <Flag tone="stop" side="right" className="mt-0.5">
          Problem
        </Flag>
        <div>
          <p className="font-semibold text-ink">{error}</p>
          {blocking && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-2">
              {blocking.map((b) => (
                <li key={b.id}>{b.title}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <button onClick={clearError} className="rounded p-1 text-ink-muted hover:bg-stop/10 hover:text-ink" aria-label="Dismiss">
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
 * On phones it spans the width just above the floating Ask button instead of covering it.
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
    <div role="status" aria-live="polite" className="no-print fixed inset-x-4 bottom-[76px] z-50 sm:inset-x-auto sm:bottom-5 sm:right-5">
      {busy ? (
        <div className="anim-toast w-full overflow-hidden rounded bg-ink text-white shadow-lift sm:w-72">
          <div className="flex items-center justify-between px-4 py-2.5 text-[13px] font-semibold">
            <span>{busy}…</span>
            <span className="text-xs tabular-nums text-white/70">{fmtElapsed(elapsed)}</span>
          </div>
          <div className="h-1 bg-white/10">
            <div className="scan-bar h-full w-1/4 bg-talker" />
          </div>
        </div>
      ) : (
        <div className="anim-toast flex items-center gap-2 rounded bg-rail px-4 py-2.5 text-[13px] font-semibold text-white shadow-lift">
          <Check className="h-4 w-4 text-talker" /> {notice}
        </div>
      )}
    </div>
  );
}

export function NoSession() {
  const loadError = useBriefStore((s) => s.loadError);
  if (loadError) return <LoadFailed />;
  return (
    <div className="ticket anim-rise mx-auto mt-16 max-w-md p-8 text-center">
      <h2 className="text-xl font-bold text-ink">No brief open</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Start from the product files, or open the hackathon sample pack, and BriefForge will read, fill and check the brief.
      </p>
      <Button asChild className="mt-6">
        <Link href="/upload">
          Start a brief <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

/** Shown when a brief could not be opened (backend down, server error); "not found" shows NoSession instead. */
export function LoadFailed() {
  const { loadError, load, busy } = useBriefStore();
  if (!loadError) return null;
  return (
    <div role="alert" className="ticket anim-rise mx-auto mt-16 max-w-md border-stop/40 p-8 pl-0 text-left">
      <Flag tone="stop" side="right">
        Problem
      </Flag>
      <div className="pl-8 pt-3">
        <h2 className="text-xl font-bold text-ink">The brief could not be opened</h2>
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
    </div>
  );
}

/** While the open brief is not in memory yet: a loading line, or the failure with a retry. */
export function SessionPending({ what = "brief" }: { what?: string }) {
  const loadError = useBriefStore((s) => s.loadError);
  return loadError ? <LoadFailed /> : <Loading what={what} />;
}

export function PageHead({ title, lead, actions }: { title: string; lead?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="min-w-0">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.01em] text-ink [font-stretch:87.5%]">{title}</h1>
        {lead && <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-ink-muted">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Loading({ what = "brief" }: { what?: string }) {
  return (
    <div className="mt-10 flex items-center gap-3 text-sm text-ink-muted" role="status">
      <span className="relative block h-1 w-24 overflow-hidden rounded bg-line">
        <span className="scan-bar absolute inset-y-0 left-0 w-1/3 bg-rail" />
      </span>
      Loading {what}…
    </div>
  );
}
