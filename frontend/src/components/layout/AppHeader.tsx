"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, FolderOpen, Plus } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

const BRIEF_ROUTES = ["/analysis", "/questions", "/review", "/export"];

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "pressable relative inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13.5px] font-semibold transition-colors duration-150 sm:px-3",
        active ? "text-ink" : "text-ink-muted hover:bg-ink/[0.06] hover:text-ink"
      )}
    >
      {children}
      {/* The active page gets an ink underline that sits on the header's bottom border. */}
      <span
        aria-hidden
        className={cn("absolute inset-x-2.5 -bottom-[13px] h-[3px] rounded-t-full bg-ink transition-opacity duration-150", active ? "opacity-100" : "opacity-0")}
      />
    </Link>
  );
}

/** Top bar for the working app: the mark, the places to go, one clear primary action, and a way back to the open brief. */
export function AppHeader() {
  const pathname = usePathname();
  const { view, reset } = useBriefStore();
  const onBrief = BRIEF_ROUTES.includes(pathname);
  const open = view?.state;
  const score = open?.readiness?.score;
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 shadow-[0_1px_0_rgba(21,24,43,0.03)] backdrop-blur-md supports-[backdrop-filter]:bg-paper/80">
      <div className="mx-auto flex h-[60px] w-full max-w-page items-center gap-3 px-4 md:px-6 xl:px-8">
        <Link href="/" className="pressable -ml-1 shrink-0 rounded-md px-1 py-1" aria-label="PackProofAI home">
          <Wordmark />
        </Link>
        <span className="mx-1 hidden h-6 w-px bg-line md:block" aria-hidden />
        <nav aria-label="Main" className="flex items-center gap-0.5">
          <NavLink href="/projects" active={pathname === "/projects"}>
            <FolderOpen className="h-4 w-4" aria-hidden /> Projects
          </NavLink>
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2.5">
          {open && !onBrief && (
            <Link
              href="/review"
              className="pressable group hidden min-w-0 max-w-[320px] items-center gap-2 rounded-full border border-line bg-paper py-1 pl-3 pr-2 text-[13px] text-ink-2 transition-colors hover:border-ink md:inline-flex"
              title={`Continue with ${open.product_name}`}
            >
              <span className="shrink-0 text-ink-muted">Continue</span>
              <span className="truncate font-semibold text-ink">{open.product_name}</span>
              {score != null && <span className="figure shrink-0 rounded-full bg-desk px-1.5 text-[13px] text-ink-2">{score}%</span>}
              <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}
          <Link
            href="/upload"
            onClick={() => reset()}
            aria-current={pathname === "/upload" ? "page" : undefined}
            className={cn(
              "pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13.5px] font-semibold text-white transition-colors duration-150",
              pathname === "/upload" ? "bg-ink-2 ring-2 ring-canary ring-offset-1" : "bg-ink hover:bg-ink-2"
            )}
          >
            <Plus className="h-4 w-4" aria-hidden /> New brief
          </Link>
        </div>
      </div>
    </header>
  );
}
