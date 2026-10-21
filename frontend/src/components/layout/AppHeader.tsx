"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, FolderOpen, Plus } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

const BRIEF_ROUTES = ["/analysis", "/questions", "/review", "/export"];

function NavLink({ href, active, children, onClick }: { href: string; active: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "pressable inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13.5px] font-semibold transition-colors duration-150 sm:px-3",
        active ? "bg-ink text-white" : "text-ink-2 hover:bg-ink/[0.06] hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}

/** Top bar for the working app: the mark, the two places to start from, and a way back to the open brief. */
export function AppHeader() {
  const pathname = usePathname();
  const { view, reset } = useBriefStore();
  const onBrief = BRIEF_ROUTES.includes(pathname);
  const open = view?.state;
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md supports-[backdrop-filter]:bg-paper/80">
      <div className="mx-auto flex h-[60px] w-full max-w-page items-center gap-3 px-4 md:px-6 xl:px-8">
        <Link href="/" className="pressable -ml-1 shrink-0 rounded-md px-1 py-1" aria-label="BriefForge home">
          <Wordmark className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
        </Link>
        <nav aria-label="Main" className="ml-1 flex items-center gap-1 sm:ml-4">
          <NavLink href="/projects" active={pathname === "/projects"}>
            <FolderOpen className="h-4 w-4" aria-hidden /> Projects
          </NavLink>
          <NavLink href="/upload" active={pathname === "/upload"} onClick={() => reset()}>
            <Plus className="h-4 w-4" aria-hidden /> New brief
          </NavLink>
        </nav>
        {open && !onBrief && (
          <Link
            href="/review"
            className="pressable group ml-auto hidden min-w-0 max-w-[340px] items-center gap-2 rounded-md border border-line bg-paper py-1.5 pl-3 pr-2 text-[13px] text-ink-2 transition-colors hover:border-ink md:inline-flex"
            title={`Continue with ${open.product_name}`}
          >
            <span className="shrink-0 text-ink-muted">Continue</span>
            <span className="truncate font-semibold text-ink">{open.product_name}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>
    </header>
  );
}
