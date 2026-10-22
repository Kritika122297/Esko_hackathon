import Link from "next/link";
import { ArrowRight, Check, Crosshair, FileDown, FileText, Send, X } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { ActionStamp, OwnerTag, Stamp } from "@/components/shared/badges";
import { cn } from "@/lib/utils";
import { ExampleCarton } from "./ExampleCarton";
import { CreateBriefButton, OpenWorkspaceButton } from "./LandingNav";

const STEPS = [
  {
    name: "Upload",
    text: "Drop the packaging PDF, the content sheet, a Word brief or notes. Choose the situation and the target market.",
    out: "Each file gets its role: artwork, content sheet, brief or notes.",
  },
  {
    name: "Analyze",
    text: "Every file is read, each brief field is filled from a real source, and the checks for that market and category run.",
    out: "Findings marked Definite error, Likely problem or Needs human check.",
  },
  {
    name: "Resolve",
    text: "Answer the questions that matter, confirm values in place, and pass anything unresolved to the person who owns it.",
    out: "Every answer and edit logged with old value, new value and reason.",
  },
  {
    name: "Handoff",
    text: "Finalize once nothing blocks, and send the agency a brief set out panel by panel, with proof for every value.",
    out: "PDF or Word, marked draft until the brief is finalized.",
  },
];

export function Workflow() {
  return (
    <section id="workflow" aria-labelledby="flow-h" className="mx-auto w-full max-w-page px-4 py-24 md:px-8 md:py-32">
      <div className="grid gap-6 lg:grid-cols-12">
        <h2 id="flow-h" className="display text-[40px] text-ink md:text-[56px] lg:col-span-7">
          From scattered files to a brief the agency can trust.
        </h2>
        <p className="max-w-[46ch] self-end text-[16px] leading-relaxed text-ink-muted lg:col-span-4 lg:col-start-9">
          The same four steps every time, whether you refresh a pack, adapt it to a new market or brief a product that has no artwork yet.
        </p>
      </div>

      <ol className="mt-14 grid overflow-hidden rounded-xl border border-line bg-paper shadow-sheet md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s, i) => {
          const handoff = i === STEPS.length - 1;
          return (
            <li
              key={s.name}
              className={cn(
                "relative flex flex-col gap-4 p-7",
                i > 0 && "border-t border-line md:border-t-0",
                i % 2 === 1 && "md:border-l md:border-line",
                i === 2 && "md:border-t xl:border-t-0",
                i === 3 && "md:border-t xl:border-t-0",
                i > 0 && "xl:border-l xl:border-line",
                handoff && "bg-sky-soft xl:border-l-[1.5px] xl:border-dashed xl:border-sky-deep/40"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("figure grid h-9 w-9 place-items-center rounded-md text-[20px]", handoff ? "bg-sky-deep text-white" : "bg-ink text-white")}>{i + 1}</span>
              </div>
              <h3 className="heading text-[24px] text-ink">{s.name}</h3>
              <p className="text-[14.5px] leading-relaxed text-ink-2">{s.text}</p>
              <p className={cn("mt-auto border-t border-dashed pt-4 text-[13px] leading-snug", handoff ? "border-sky-deep/30 text-sky-deep" : "border-line-strong text-ink-muted")}>{s.out}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ----------------------------------------------------------------- feature demos */

function CheckRow({ name, detail, result }: { name: string; detail: string; result: "pass" | "error" | "warn" }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t border-line px-5 py-3.5 first:border-t-0">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink">{name}</p>
        <p className="mt-0.5 text-[13px] tabular-nums leading-snug text-ink-muted">{detail}</p>
      </div>
      {result === "pass" ? (
        <Stamp tone="ok">
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> Pass
        </Stamp>
      ) : result === "error" ? (
        <Stamp tone="stop">
          <X className="h-3 w-3" strokeWidth={3} aria-hidden /> Error
        </Stamp>
      ) : (
        <Stamp tone="gold">Check</Stamp>
      )}
    </li>
  );
}

function ComplianceDemo() {
  return (
    <div className="sheet overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-desk/50 px-5 py-3">
        <p className="text-[13px] font-semibold text-ink">Checks for US food rules</p>
        <span className="meta">Example pack</span>
      </div>
      <ul>
        <CheckRow name="Servings per container" detail="340 g ÷ 28 g = 12.1 servings; the panel says about 12" result="pass" />
        <CheckRow name="Sodium % Daily Value" detail="140 mg ÷ 2,300 mg = 6%; the panel prints 9%" result="error" />
        <CheckRow name="“Good source of fiber” claim" detail="Needs at least 2.8 g a serving; the panel shows 2 g" result="warn" />
        <CheckRow name="Allergens against ingredients" detail="Almonds appear in both the ingredients and the statement" result="pass" />
        <CheckRow name="UPC-A check digit" detail="0 41234 56789 1: the check digit is right" result="pass" />
      </ul>
    </div>
  );
}

function ProofDemo() {
  return (
    <div className="sheet overflow-hidden">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-ink-muted">Net quantity</p>
            <Stamp tone="ok">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> Confirmed
            </Stamp>
          </div>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="figure text-[64px] text-ink">340</span>
            <span className="text-[15px] font-semibold text-ink-2">g · 12 oz</span>
          </p>
        </div>
        <div className="relative hidden border-l border-line bg-[#F4F5F8] sm:block">
          <ExampleCarton viewBox="80 330 175 74" className="absolute inset-0 h-full w-full" label="Detail of the example front panel showing NET WT 12 OZ (340 g)" />
          <span aria-hidden className="absolute left-[6%] top-[52%] h-[30%] w-[72%] rounded-[3px] border-[2.5px] border-ink bg-canary/45 shadow-[0_0_0_3px_#FFFFFF]" />
        </div>
      </div>
      <div className="perf mx-0" />
      <ul className="space-y-2.5 px-6 py-5 text-[13px]">
        <li className="flex items-start gap-2.5">
          <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" aria-hidden />
          <span>
            <b className="font-semibold text-ink">Artwork · Front panel</b>
            <span className="text-ink-muted"> printed as “NET WT 12 OZ (340 g)”</span>
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" aria-hidden />
          <span>
            <b className="font-semibold text-ink">Content sheet · cell B9</b>
            <span className="text-ink-muted"> “340 g”, with the cell note “12 oz on US packs”</span>
          </span>
        </li>
        <li className="flex items-start gap-2.5 text-ink-muted">
          <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border border-dashed border-ink-faint" aria-hidden />
          A value with no source stays marked Missing.
        </li>
      </ul>
    </div>
  );
}

function OwnerRow({ owner, done, total }: { owner: string; done: number; total: number }) {
  return (
    <li className="grid grid-cols-[110px_minmax(0,1fr)_44px] items-center gap-3">
      <OwnerTag owner={owner} className="justify-self-start" />
      <span className="h-1.5 overflow-hidden rounded-full bg-desk-2" aria-hidden>
        <span className="block h-full rounded-full bg-ink" style={{ width: `${(done / total) * 100}%` }} />
      </span>
      <span className="figure text-right text-[18px] text-ink">
        {done}/{total}
      </span>
    </li>
  );
}

function DecisionsDemo() {
  return (
    <div className="sheet overflow-hidden">
      <div className="p-6">
        <p className="text-[13px] font-semibold text-ink-muted">Questions answered, by owner</p>
        <ul className="mt-4 space-y-3">
          <OwnerRow owner="R&D" done={2} total={3} />
          <OwnerRow owner="Legal" done={1} total={2} />
          <OwnerRow owner="Supply Chain" done={0} total={1} />
          <OwnerRow owner="Brand" done={1} total={1} />
        </ul>
      </div>
      <div className="border-t border-line bg-desk/50 px-6 py-4">
        <p className="text-[13px] font-semibold text-ink-muted">Change log</p>
        <ol className="mt-2 space-y-2 text-[13px] leading-snug">
          <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-2">
            <span className="tabular-nums text-ink-faint">10:42</span>
            <span className="text-ink-2">
              <b className="font-semibold text-ink">Net quantity</b> confirmed by reviewer
            </span>
          </li>
          <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-2">
            <span className="tabular-nums text-ink-faint">10:44</span>
            <span className="text-ink-2">
              <b className="font-semibold text-ink">Allergen statement</b> “Contains: almonds” → “Contains: almonds, milk” · R&amp;D answer
            </span>
          </li>
          <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-2">
            <span className="tabular-nums text-ink-faint">10:47</span>
            <span className="text-ink-2">
              <b className="font-semibold text-ink">Shelf-life wording</b> passed to the agency as an open question
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}

function HandoffDemo() {
  return (
    <div className="relative">
      <div className="sheet overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <p className="heading text-[18px] text-ink">Front panel</p>
          <span className="meta">7 items</span>
        </div>
        <ul className="space-y-2.5 px-6 pb-6 pt-4 text-[13.5px]">
          <li className="flex items-start gap-3">
            <ActionStamp action="change" />
            <span className="text-ink-2">
              Sodium %DV <span className="text-ink-muted line-through decoration-stop/60">9%</span> <b className="font-semibold text-ink">6%</b>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <ActionStamp action="remove" />
            <span className="text-ink-2">“Good source of fiber” badge, until R&amp;D confirms 2.8 g</span>
          </li>
          <li className="flex items-start gap-3">
            <ActionStamp action="add" />
            <span className="text-ink-2">“Contains: almonds, milk” on the side panel</span>
          </li>
          <li className="flex items-start gap-3">
            <ActionStamp action="keep" />
            <span className="text-ink-muted">Product name, net quantity and 2 more</span>
          </li>
        </ul>
        <div className="perf" />
        <div className="flex flex-wrap items-center justify-between gap-3 bg-sky-soft px-6 py-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-sky-deep">
            <Send className="h-3.5 w-3.5" aria-hidden /> Tear off for the agency
          </p>
          <span className="flex gap-1.5">
            <span className="inline-flex h-7 items-center gap-1 rounded-md bg-paper px-2 text-[12px] font-semibold text-ink shadow-sheet">
              <FileDown className="h-3.5 w-3.5" aria-hidden /> PDF
            </span>
            <span className="inline-flex h-7 items-center gap-1 rounded-md bg-paper px-2 text-[12px] font-semibold text-ink shadow-sheet">
              <FileDown className="h-3.5 w-3.5" aria-hidden /> Word
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    id: "compliance",
    title: "Compliance, checked by code",
    text: "Deterministic checks verify nutrition math, % Daily Values, serving math, ingredient order, claims against ingredients, allergen wording and barcode check digits, then apply the label rules for the market and category you choose. Errors in the source files are caught instead of copied into the brief.",
    note: "Draft rule packs cover the US, the EU with France, Germany, Spain, Italy and the Netherlands, and India. Every rule cites its source, and the packs await Legal review.",
    demo: <ComplianceDemo />,
  },
  {
    id: "evidence",
    title: "Evidence behind every value",
    text: "Each value links to its exact source: a spot on a named artwork panel, or a content-sheet cell and its note. Click it and the pack scrolls to the spot. Values that nobody provided stay missing, so nothing on the brief is invented.",
    note: "Printing-guide marks are filtered out, and text hidden under later artwork is detected.",
    demo: <ProofDemo />,
  },
  {
    id: "decisions",
    title: "Decisions routed to the people who own them",
    text: "Questions are ranked, explained and sent to R&D, Legal, Supply Chain, Brand or the agency. Preview what an edit would resolve or introduce before you save it. Every answer, edit and hand-off is logged with the old value, the new value and the reason.",
    note: "Every decision can be undone, and an item passed on stays visible as an open question.",
    demo: <DecisionsDemo />,
  },
  {
    id: "handoff",
    title: "A handoff designers can act on",
    text: "The designer brief is set out as Keep, Change, Add, Remove and Unknown for each panel, with the approved copy and the open questions. Finalizing stays locked until every blocking item is answered or passed on openly.",
    note: "Designer tasks never block. Downloads stay marked draft until the brief is finalized.",
    demo: <HandoffDemo />,
  },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-h" className="border-y border-line bg-paper">
      <div className="mx-auto w-full max-w-page px-4 py-24 md:px-8 md:py-32">
        <h2 id="features-h" className="display max-w-[16ch] text-[40px] text-ink md:text-[56px]">
          Built to be checked, not trusted.
        </h2>
        <div className="mt-16 space-y-24 md:space-y-32">
          {FEATURES.map((f, i) => (
            <article key={f.id} aria-labelledby={`${f.id}-h`} className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
              <div className={cn("lg:col-span-5", i % 2 === 1 && "lg:order-2 lg:col-start-8")}>
                <h3 id={`${f.id}-h`} className="heading text-[28px] text-ink md:text-[32px]">
                  {f.title}
                </h3>
                <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-ink-2">{f.text}</p>
                <p className="mt-5 max-w-[52ch] border-l border-line-strong pl-4 text-[14px] leading-relaxed text-ink-muted">{f.note}</p>
              </div>
              <div className={cn("lg:col-span-6", i % 2 === 1 ? "lg:order-1 lg:col-start-1" : "lg:col-start-7")}>{f.demo}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const PRINCIPLES = [
  {
    line: "AI reads and suggests.",
    text: "AI can cross-check printed values, read scans and word questions plainly. Its findings are always marked Needs human check and never block on their own. Everything works with AI switched off.",
  },
  {
    line: "Code checks.",
    text: "Arithmetic, claims, allergens and market rules are calculated, so a Definite error is something you can trace, not an opinion.",
  },
  {
    line: "Humans decide.",
    text: "Every decision is logged and reversible. Nothing reaches the agency unless a person confirmed it or passed it on as an open question.",
  },
];

export function Principles() {
  return (
    <section id="principles" aria-labelledby="principles-h" className="mx-auto w-full max-w-page px-4 py-24 md:px-8 md:py-32">
      <h2 id="principles-h" className="sr-only">
        How PackProofAI handles uncertainty
      </h2>
      <div className="divide-y divide-line border-y border-line">
        {PRINCIPLES.map((p) => (
          <div key={p.line} className="grid gap-4 py-8 md:grid-cols-12 md:items-baseline md:gap-10 md:py-10">
            <p className="display text-[44px] text-ink md:col-span-7 md:text-[72px]">{p.line}</p>
            <p className="max-w-[48ch] text-[15.5px] leading-relaxed text-ink-muted md:col-span-5">{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="cta-h" className="px-4 pb-6 md:px-8">
      <div className="relative mx-auto w-full max-w-page overflow-hidden rounded-2xl bg-canary px-6 py-16 md:px-14 md:py-24">
        <div className="relative grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <h2 id="cta-h" className="display text-[44px] text-ink md:text-[76px]">
              Start with the files you already have.
            </h2>
            <p className="mt-5 max-w-[54ch] text-[17px] leading-relaxed text-ink-2">
              An old packaging PDF and a content sheet are enough. PackProofAI shows what is right, what is missing and who has to decide, before the agency starts.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-4 lg:flex-col lg:items-end">
            <span aria-hidden className="mb-4 hidden rotate-[-6deg] lg:block">
              <Stamp tone="ink" size="lg" className="bg-transparent text-[18px] [padding:8px_14px]">
                Ready for handoff
              </Stamp>
            </span>
            <CreateBriefButton size="xl">
              Create a brief <ArrowRight className="h-4 w-4" aria-hidden />
            </CreateBriefButton>
            <OpenWorkspaceButton size="xl" variant="outline" className="border-ink/30 bg-transparent hover:bg-paper/50" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-page px-4 pb-10 pt-12 md:px-8">
      <div className="flex flex-col gap-8 border-t border-line pt-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">Product files to a checked, source-linked packaging design brief.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] font-semibold">
          <Link href="/projects" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            Projects
          </Link>
          <CreateBriefButton variant="link" className="text-[14px] text-ink-2 no-underline hover:text-ink hover:underline" />
          <OpenWorkspaceButton variant="link" className="text-[14px] text-ink-2 no-underline hover:text-ink hover:underline" />
        </nav>
      </div>
      <p className="mt-8 max-w-[80ch] text-[12.5px] leading-relaxed text-ink-faint">
        Label rule packs are drafts that need Legal review before use. The pack, values and decisions shown on this page are an illustrative example, not customer data.
      </p>
    </footer>
  );
}
