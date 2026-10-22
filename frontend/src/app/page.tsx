import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { CreateBriefButton, LandingNav, OpenWorkspaceButton } from "@/components/landing/LandingNav";
import { PackPreview } from "@/components/landing/PackPreview";
import { Features, FinalCta, Footer, Principles, Workflow } from "@/components/landing/Sections";

export const metadata: Metadata = {
  title: { absolute: "PackProofAI: catch it in the brief, not on press" },
  description:
    "PackProofAI reads packaging artwork, content sheets and notes, fills a design brief with proof for every value, checks it, and routes the open decisions to the people who own them.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <LandingNav />
      <main id="main">
        <section aria-labelledby="hero-h" className="mx-auto w-full max-w-page px-4 pb-14 pt-12 md:px-8 md:pb-20 md:pt-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
            <h1 id="hero-h" className="display text-[clamp(52px,8.6vw,128px)] text-ink lg:col-span-8">
              <span className="anim-line" style={{ animationDelay: "40ms" }}>
                Catch it in the brief,
              </span>
              <span className="anim-line" style={{ animationDelay: "150ms" }}>
                not on press.
              </span>
            </h1>
            <div className="anim-rise lg:col-span-4 lg:pb-3" style={{ animationDelay: "260ms" }}>
              <p className="max-w-[44ch] text-[17px] leading-relaxed text-ink-2">
                PackProofAI reads your packaging artwork, content sheet and notes, fills the design brief with proof for every value, checks the math, claims and label rules,
                and asks the right person only the questions that matter.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <CreateBriefButton size="xl">
                  Create a brief <ArrowRight className="h-4 w-4" aria-hidden />
                </CreateBriefButton>
                <OpenWorkspaceButton size="xl" variant="outline" />
              </div>
            </div>
          </div>
        </section>

        <section aria-label="A working example" className="relative border-y border-line bg-desk-2">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(21,24,43,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(21,24,43,0.05)_1px,transparent_1px)] [background-size:24px_24px]"
          />
          <div className="relative mx-auto w-full max-w-page px-4 pb-14 pt-8 md:px-8 md:pb-20">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13.5px] font-semibold text-ink-2">
                Example pack <span className="font-normal text-ink-muted">· illustrative data</span>
              </p>
              <p className="text-[13.5px] text-ink-muted">
                <span className="hidden lg:inline">Point at a value to trace it to the pack. </span>Answer the question to re-check the brief.
              </p>
            </div>
            <PackPreview />
          </div>
        </section>

        <Workflow />
        <Features />
        <Principles />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
