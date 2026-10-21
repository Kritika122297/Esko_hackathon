"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Sparkles } from "lucide-react";
import { AskButton } from "@/components/chat/ChatPanel";
import { AddFilesButton } from "@/components/upload/AddFilesDialog";
import { MarketChip, Stamp } from "@/components/shared/badges";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { ReadinessBar } from "@/components/ui/ReadinessBar";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

export const CASE_TEXT: Record<string, string> = {
  update: "Pack refresh",
  new_market: "New market",
  new_product: "New product",
};

const STAGES = [
  { href: "/analysis", label: "Findings" },
  { href: "/questions", label: "Questions" },
  { href: "/review", label: "Workbench" },
  { href: "/export", label: "Designer brief" },
];

/** What the AI did on this brief, and what it could not do, in plain words. */
function AiStatus({ ai }: { ai: { enabled: boolean; used_for: string[]; notes: string[] } }) {
  const [open, setOpen] = useState(false);
  const steps = ai.used_for.length;
  const problems = ai.notes.filter((n) => /did not run|switched off/i.test(n)).length;
  return (
    <div className="text-[12.5px] text-ink-muted">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="ai-status-list"
        className="inline-flex items-center gap-1.5 rounded-md py-1 pr-1 hover:text-ink"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        <span className="font-semibold text-ink">AI {ai.enabled ? "on" : "off"}</span>
        {ai.enabled && <span>· {steps} step{steps === 1 ? "" : "s"} ran</span>}
        {problems > 0 && <span className="font-semibold text-stop-deep">· {problems} did not run</span>}
        <span className="hidden text-ink-faint sm:inline">· AI suggests, code checks, a person decides</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 ease-out", open && "rotate-180")} aria-hidden />
      </button>
      <div id="ai-status-list" className="disclosure" data-open={open}>
        <div>
          <ul className="space-y-0.5 pb-2 pl-5 pt-1">
            {ai.used_for.map((t, i) => (
              <li key={`u${i}`} className="list-disc">
                {t}
              </li>
            ))}
            {ai.notes.map((t, i) => (
              <li key={`n${i}`} className="list-[circle]">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** The four stages of a brief, with one ink rule that slides to the stage you are on. */
function Stepper({ counts }: { counts: Record<string, number | undefined> }) {
  const pathname = usePathname();
  const list = useRef<HTMLOListElement | null>(null);
  const [rule, setRule] = useState<{ x: number; w: number } | null>(null);
  const [animate, setAnimate] = useState(false);
  const activeIndex = STAGES.findIndex((s) => s.href === pathname);

  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => {
      const a = el.querySelector<HTMLAnchorElement>('[aria-current="page"]');
      setRule(a ? { x: a.offsetLeft, w: a.offsetWidth } : null);
    };
    measure();
    // On narrow screens the stage list scrolls; keep the current stage in view.
    const nav = el.parentElement;
    const a = el.querySelector<HTMLAnchorElement>('[aria-current="page"]');
    if (nav && a && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = Math.max(0, a.offsetLeft + a.offsetWidth / 2 - nav.clientWidth / 2);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pathname]);
  useLayoutEffect(() => {
    if (!rule || animate) return;
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(t);
  }, [rule, animate]);

  return (
    <nav aria-label="Brief stages" className="-mb-px min-w-0 overflow-x-auto">
      <ol ref={list} className="relative flex min-w-max items-stretch">
        {STAGES.map((s, i) => {
          const active = s.href === pathname;
          const done = activeIndex > i;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-12 items-center gap-2 px-3 text-[13.5px] font-semibold transition-colors duration-150 first:pl-0 sm:px-4",
                  active ? "text-ink" : "text-ink-muted hover:text-ink"
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-[5px] text-[11px] font-bold tabular-nums transition-colors duration-200",
                    active ? "bg-ink text-white" : done ? "bg-ink/10 text-ink" : "border border-line-strong text-ink-muted group-hover:border-ink"
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
                {s.label}
                {counts[s.href] ? (
                  <span
                    className={cn(
                      "inline-flex items-baseline gap-1 rounded-[4px] px-1.5 pb-px pt-[2px] text-[11.5px] font-semibold",
                      s.href === "/analysis" ? "bg-stop-soft text-stop-deep" : "bg-canary-soft text-canary-deep"
                    )}
                  >
                    <span className="figure text-[14px]">{counts[s.href]}</span>
                    <span className="hidden sm:inline">{s.href === "/analysis" ? "blocking" : "open"}</span>
                    <span className="sr-only sm:hidden">{s.href === "/analysis" ? "blocking" : "open"}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
        {rule && (
          <span
            aria-hidden
            className={cn("absolute bottom-0 left-0 h-[2.5px] w-[100px] bg-ink", animate && "seg-indicator")}
            style={{ transform: `translateX(${rule.x + (rule.x === 0 ? 0 : 12)}px) scaleX(${(rule.w - (rule.x === 0 ? 12 : 24)) / 100})` }}
          />
        )}
      </ol>
    </nav>
  );
}

/** Publishes where sticky work areas should start: below the top bar and this bar, on wide screens. */
function useStickyTop(el: React.RefObject<HTMLDivElement>, on: boolean) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const node = el.current;
    if (!on || !node) {
      root.style.removeProperty("--stick-top");
      return;
    }
    const set = () => root.style.setProperty("--stick-top", `${60 + node.offsetHeight + 16}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(node);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--stick-top");
    };
  }, [el, on]);
}

/** The open brief's bar on every stage: which product, which market, how far along, and where you are. */
export function BriefBar() {
  const view = useBriefStore((s) => s.view);
  const pathname = usePathname();
  const bar = useRef<HTMLDivElement>(null);
  const s = view?.state;
  const shown = !!s && STAGES.some((x) => x.href === pathname);
  useStickyTop(bar, shown);
  if (!s || !shown) return null;
  const r = s.readiness;
  const total = Math.max(r?.fields_total ?? 1, 1);
  const counts: Record<string, number | undefined> = {
    "/analysis": r?.blocking_open || undefined,
    "/questions": s.questions.length || undefined,
  };
  const finalized = s.status === "finalized";

  return (
    <div ref={bar} className="no-print border-b border-line bg-paper lg:sticky lg:top-[60px] lg:z-30">
      <div className="mx-auto w-full max-w-page px-4 md:px-6 xl:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="heading min-w-0 truncate text-[20px] text-ink md:text-[22px]" title={s.product_name}>
              {s.product_name}
            </p>
            <MarketChip market={s.market} from={s.source_market} />
            <span className="inline-flex h-6 items-center rounded-sm bg-desk px-2 text-[12px] font-semibold text-ink-2">{CASE_TEXT[s.case] ?? s.case}</span>
            <Stamp tone={finalized ? "ok" : "muted"} landed={s.status}>
              {finalized ? "Finalized" : "Draft"}
            </Stamp>
          </div>
          <div className="flex items-center gap-2">
            <AddFilesButton />
            <AskButton />
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <Stepper counts={counts} />
          {r && (
            <div className="flex items-center gap-4 pb-2.5">
              <div className="flex items-baseline gap-1.5">
                <RollingNumber value={r.score} className="text-[30px] text-ink" suffix={<span className="text-[18px]">%</span>} label={`Brief readiness ${r.score} percent`} />
                <span className="text-[12.5px] text-ink-muted">ready</span>
              </div>
              <div className="hidden w-52 sm:block">
                <ReadinessBar confirmed={r.fields_confirmed / total} review={r.fields_needs_review / total} />
                <p className="meta mt-1">
                  {r.fields_confirmed} confirmed · {r.fields_needs_review} to review · {r.fields_missing} missing
                </p>
              </div>
              {r.blocking_open > 0 ? (
                <Stamp tone="stop" landed={String(r.blocking_open)} className="hidden sm:inline-flex">
                  {r.blocking_open} blocking
                </Stamp>
              ) : (
                <Stamp tone="ok" landed="clear" className="hidden sm:inline-flex">
                  None blocking
                </Stamp>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-page border-t border-line/70 px-4 md:px-6 xl:px-8">
        <AiStatus ai={s.ai} />
      </div>
    </div>
  );
}

/** Each route enters with a short rise and a blur that clears, so a stage change reads as one move. */
export function RouteEnter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="anim-enter">
      {children}
    </div>
  );
}
