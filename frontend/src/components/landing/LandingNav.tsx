"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

/** The remembered brief's workbench when one is open in this browser, otherwise the project library. */
function useWorkspaceHref() {
  const sessionId = useBriefStore((s) => s.sessionId);
  const [href, setHref] = useState("/projects");
  useEffect(() => setHref(sessionId ? "/review" : "/projects"), [sessionId]);
  return href;
}

/** Starts a fresh brief: clears whatever brief was open, exactly as the app's New brief link does. */
export function CreateBriefButton({ children = "Create a brief", ...props }: ButtonProps) {
  const reset = useBriefStore((s) => s.reset);
  return (
    <Button asChild {...props}>
      <Link href="/upload" onClick={() => reset()}>
        {children}
      </Link>
    </Button>
  );
}

export function OpenWorkspaceButton({ children = "Open workspace", ...props }: ButtonProps) {
  const href = useWorkspaceHref();
  return (
    <Button asChild {...props}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

const SECTIONS: [string, string][] = [
  ["#workflow", "How it works"],
  ["#features", "Features"],
  ["#principles", "Principles"],
];

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300",
        scrolled || open ? "border-b border-line bg-paper/85 shadow-[0_1px_0_rgba(21,24,43,0.03)] backdrop-blur-md" : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-page items-center gap-4 px-4 md:px-8">
        <Link href="/" className="pressable rounded-md px-1 py-1" aria-label="PackProofAI home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {SECTIONS.map(([href, label]) => (
            <a key={href} href={href} className="pressable rounded-md px-3 py-2 text-[14px] font-semibold text-ink-muted transition-colors hover:bg-ink/[0.06] hover:text-ink">
              {label}
            </a>
          ))}
          <span className="mx-2 h-5 w-px bg-line" aria-hidden />
          <Button asChild variant="ghost">
            <Link href="/projects">Projects</Link>
          </Button>
          <OpenWorkspaceButton variant="outline" />
          <CreateBriefButton className="ml-1">
            Create a brief <ArrowRight className="h-4 w-4" aria-hidden />
          </CreateBriefButton>
        </nav>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="landing-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="pressable ml-auto grid h-10 w-10 place-items-center rounded-md hover:bg-ink/[0.06] md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <div id="landing-menu" className="disclosure md:hidden" data-open={open} inert={!open ? ("" as unknown as boolean) : undefined}>
        <div>
          <nav aria-label="Main menu" className="flex flex-col gap-2 px-4 pb-5 pt-1">
            <div className="mb-1 grid grid-cols-3 gap-2">
              {SECTIONS.map(([href, label]) => (
                <a key={href} href={href} onClick={() => setOpen(false)} className="pressable rounded-md bg-desk px-3 py-2.5 text-center text-[13.5px] font-semibold text-ink-2">
                  {label}
                </a>
              ))}
            </div>
            <CreateBriefButton size="lg" className="w-full" />
            <OpenWorkspaceButton size="lg" variant="outline" className="w-full" />
            <Button asChild size="lg" variant="ghost" className="w-full">
              <Link href="/projects">Projects</Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
