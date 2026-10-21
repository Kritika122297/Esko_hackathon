"use client";

import { usePathname } from "next/navigation";
import { AskButton } from "@/components/chat/ChatPanel";
import { AddFilesButton } from "@/components/upload/AddFilesDialog";
import { Flag } from "@/components/shared/badges";
import { useBriefStore } from "@/store/briefStore";

const CASE_TEXT: Record<string, string> = {
  update: "Pack refresh",
  new_market: "New market",
  new_product: "New product",
};

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5 text-xs text-ink-muted">
      <b className="figure text-[26px] text-ink">{n}</b>
      {label}
    </span>
  );
}

/** What the AI did on this brief, and what it could not do, in plain words. */
function AiStatus({ ai }: { ai: { enabled: boolean; used_for: string[]; notes: string[] } }) {
  const steps = ai.used_for.length;
  const problems = ai.notes.filter((n) => /did not run|switched off/i.test(n)).length;
  return (
    <details className="mx-auto w-full max-w-[1600px] px-4 pb-2 text-xs text-ink-muted md:px-6">
      <summary className="cursor-pointer select-none">
        <span className="font-semibold text-ink">AI {ai.enabled ? "on" : "off"}</span>
        {ai.enabled && ` · ${steps} step${steps === 1 ? "" : "s"} ran`}
        {problems > 0 && <span className="font-semibold text-stop"> · {problems} did not run</span>}
        <span className="ml-2 text-ink-faint">AI suggests, code checks, a person decides</span>
      </summary>
      <ul className="mt-1.5 space-y-0.5 pl-4">
        {ai.used_for.map((t, i) => (
          <li key={`u${i}`}>✓ {t}</li>
        ))}
        {ai.notes.map((t, i) => (
          <li key={`n${i}`}>• {t}</li>
        ))}
      </ul>
    </details>
  );
}

/** Product context for every screen: which brief, which market, how far along. */
export function ContextBar() {
  const view = useBriefStore((s) => s.view);
  const pathname = usePathname();
  const s = view?.state;
  if (!s || pathname === "/upload" || pathname === "/projects") return null;
  const r = s.readiness;
  return (
    <div className="no-print border-b border-line bg-ground/95 backdrop-blur-[2px] lg:sticky lg:top-0 lg:z-30">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 md:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-[17px] font-bold text-ink">{s.product_name}</p>
          <span className="rounded border border-line bg-stock px-2 py-0.5 text-xs font-semibold">Market {s.market}</span>
          <span className="rounded border border-line bg-stock px-2 py-0.5 text-xs font-semibold">{CASE_TEXT[s.case] ?? s.case}</span>
          <span className={s.status === "finalized" ? "rounded bg-rail px-2 py-0.5 text-xs font-semibold text-white" : "rounded border border-line bg-stock px-2 py-0.5 text-xs font-semibold"}>
            {s.status === "finalized" ? "Finalized" : "Draft"}
          </span>
        </div>
        {r && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Count n={r.fields_confirmed} label="confirmed" />
            <Count n={r.fields_needs_review} label="to review" />
            <Count n={r.fields_missing} label="missing" />
            <span className="hidden text-xs text-ink-muted sm:inline">
              of <b className="figure text-[26px] text-ink">{r.fields_total}</b> fields
            </span>
            {r.blocking_open > 0 ? (
              <Flag tone="stop">{r.blocking_open} blocking open</Flag>
            ) : (
              <Flag tone="ok">No blocking items</Flag>
            )}
            <AddFilesButton />
            <AskButton className="hidden lg:inline-flex" />
          </div>
        )}
      </div>
      <AiStatus ai={s.ai} />
    </div>
  );
}

export function RouteFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="anim-rise">
      {children}
    </div>
  );
}
