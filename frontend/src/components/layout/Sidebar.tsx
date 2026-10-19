"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, Menu, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

const STEPS = [
  { href: "/analysis", label: "Findings", hint: "Read, filled, checked" },
  { href: "/questions", label: "Questions", hint: "Decisions to make" },
  { href: "/review", label: "Workbench", hint: "Review and finalize" },
  { href: "/export", label: "Designer brief", hint: "Agency handoff" },
];

function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/projects" className={cn("block text-[22px] font-extrabold leading-none tracking-[0.01em] text-white [font-stretch:75%]", className)}>
      BriefForge
    </Link>
  );
}

function NavRow({
  href,
  label,
  hint,
  mark,
  count,
  enabled = true,
  onNavigate,
}: {
  href: string;
  label: string;
  hint: string;
  mark: React.ReactNode;
  count?: number;
  enabled?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  const inner = (
    <span
      className={cn(
        "group flex h-11 items-center gap-3 rounded px-2 transition-colors duration-150",
        active ? "bg-stock text-ink" : enabled ? "text-white/85 hover:bg-white/10 hover:text-white" : "cursor-not-allowed text-white/40"
      )}
    >
      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded text-[11px] font-semibold tabular-nums", active ? "border border-ink" : "border border-white/35")}>
        {mark}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[14px] leading-tight", active ? "font-bold" : "font-medium")}>{label}</span>
        <span className={cn("block truncate text-[11px] leading-tight", active ? "text-ink-muted" : "text-white/55")}>{hint}</span>
      </span>
      {count ? (
        <span className="figure rounded bg-talker px-1.5 py-1 text-[14px] text-ink" aria-label={`${count} open`}>
          {count}
        </span>
      ) : null}
    </span>
  );
  return (
    <li>
      {enabled ? (
        <Link href={href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
          {inner}
        </Link>
      ) : (
        <span aria-disabled="true">{inner}</span>
      )}
    </li>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { sessionId, view, reset } = useBriefStore();
  const s = view?.state;
  const counts: Record<string, number | undefined> = {
    "/analysis": s?.readiness?.blocking_open || undefined,
    "/questions": s?.questions.length || undefined,
  };
  return (
    <div className="space-y-6">
      <ul className="space-y-1">
        <NavRow href="/projects" label="Projects" hint="All briefs" mark={<FolderOpen className="h-3.5 w-3.5" />} onNavigate={onNavigate} />
        <NavRow
          href="/upload"
          label="New brief"
          hint="Upload product files"
          mark={<Plus className="h-3.5 w-3.5" />}
          onNavigate={() => {
            reset();
            onNavigate?.();
          }}
        />
      </ul>
      <div>
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/55">Open brief</p>
        {s ? (
          <p className="mb-2 truncate px-2 text-[14px] font-bold text-white" title={s.product_name}>
            {s.product_name}
          </p>
        ) : (
          <p className="mb-2 px-2 text-[12px] leading-snug text-white/60">Open one from Projects, or start a new brief.</p>
        )}
        <ol className="space-y-1">
          {STEPS.map((item, i) => (
            <NavRow key={item.href} {...item} mark={i + 1} count={counts[item.href]} enabled={Boolean(sessionId)} onNavigate={onNavigate} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function RailFooter() {
  const s = useBriefStore((st) => st.view?.state);
  return (
    <div className="border-t border-white/15 pt-4">
      {s ? (
        <p className="meta leading-relaxed text-white/70">
          Market {s.market} · {s.status === "finalized" ? "Finalized" : "Draft"}
        </p>
      ) : (
        <p className="text-[12px] leading-snug text-white/65">Product files to a checked design brief.</p>
      )}
    </div>
  );
}

export function Sidebar() {
  return (
    <nav aria-label="Main" className="on-rail no-print fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-rail px-4 py-6 text-white lg:flex">
      <Wordmark className="px-2" />
      <div className="mt-8 flex-1 overflow-y-auto">
        <NavList />
      </div>
      <RailFooter />
    </nav>
  );
}

export function MobileBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="on-rail no-print sticky top-0 z-40 bg-rail text-white lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Wordmark />
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="grid h-10 w-10 place-items-center rounded hover:bg-white/10"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <div id="mobile-nav" className="disclosure" data-open={open}>
        <div>
          <div className="space-y-4 px-4 pb-5">
            <NavList onNavigate={() => setOpen(false)} />
            <RailFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
