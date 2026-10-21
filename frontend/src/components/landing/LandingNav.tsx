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
        scrolled || open ? "border-b border-line bg-paper/85 backdrop-blur-md" : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-page items-center gap-4 px-4 md:px-8">
        <Link href="/" className="pressable rounded-md px-1 py-1" aria-label="BriefForge home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
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
      <div id="landing-menu" className="disclosure md:hidden" data-open={open}>
        <div>
          <nav aria-label="Main menu" className="flex flex-col gap-2 px-4 pb-5 pt-1">
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
