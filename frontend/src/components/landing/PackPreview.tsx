"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Crosshair, RotateCcw } from "lucide-react";
import { MarketChip, OwnerTag, Stamp, StatusStamp } from "@/components/shared/badges";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { ReadinessBar } from "@/components/ui/ReadinessBar";
import { cn } from "@/lib/utils";
import { CARTON, ExampleCarton, SPOTS } from "./ExampleCarton";

type Key = "name" | "net" | "allergen" | "sodium";
type Status = "confirmed" | "needs_review";

interface ExampleField {
  key: Key;
  label: string;
  value: string;
  unit?: string;
  figure?: boolean;
  status: Status;
  proof: string[];
  spotLabel: string;
}

const STAGE = { w: 1200, h: 640 };
const ART = { x: 0, y: 48, header: 46 };
const BRIEF = { x: 380, top: 132, row: 104 };
const ORDER: Key[] = ["name", "net", "allergen", "sodium"];

function fieldsFor(answered: boolean): ExampleField[] {
  return [
    { key: "name", label: "Product name", value: "Northfield Oat Clusters, Honey Almond", status: "confirmed", proof: ["Artwork · Front", "Sheet · B3"], spotLabel: "Front panel" },
    { key: "net", label: "Net quantity", value: "340", unit: "g · 12 oz", figure: true, status: "confirmed", proof: ["Artwork · Front", "Sheet · B9"], spotLabel: "Front panel" },
    {
      key: "allergen",
      label: "Allergen statement",
      value: answered ? "Contains: almonds, milk" : "Contains: almonds",
      status: answered ? "confirmed" : "needs_review",
      proof: answered ? ["Sheet · B21", "R&D answer"] : ["Artwork · Side"],
      spotLabel: "Side panel",
    },
    { key: "sodium", label: "Sodium per serving", value: "140", unit: "mg · 9% DV", figure: true, status: "needs_review", proof: ["Artwork · Nutrition", "Sheet · B30"], spotLabel: "Nutrition panel" },
  ];
}

/** Respects reduced motion for the timed parts of the sequence. */
function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

function Highlight({ spot, label }: { spot: Key; label: string }) {
  const [x0, y0, x1, y1] = SPOTS[spot];
  const pad = 4;
  return (
    <div
      aria-hidden
      title={label}
      className="pointer-events-none absolute rounded-[3px] border-[2.5px] border-ink bg-canary/45 shadow-[0_0_0_3px_#FFFFFF,0_8px_20px_rgba(21,24,43,0.35)] transition-[left,top,width,height] duration-500 ease-out motion-reduce:transition-none"
      style={{
        left: `${((x0 - pad) / CARTON.width) * 100}%`,
        top: `${((y0 - pad) / CARTON.height) * 100}%`,
        width: `${((x1 - x0 + pad * 2) / CARTON.width) * 100}%`,
        height: `${((y1 - y0 + pad * 2) / CARTON.height) * 100}%`,
      }}
    />
  );
}

function ArtworkSheet({ active, fieldLabel, spotLabel, className, style }: { active: Key; fieldLabel: string; spotLabel: string; className?: string; style?: React.CSSProperties }) {
  return (
    <figure className={cn("sheet overflow-hidden", className)} style={style}>
      <div className="flex h-[46px] items-center justify-between border-b border-line px-4">
        <span className="text-[13px] font-semibold text-ink">Artwork</span>
        <span className="truncate pl-3 text-[12px] text-ink-muted">northfield-oat-clusters_carton.pdf</span>
      </div>
      <div className="relative bg-[#F4F5F8]">
        <ExampleCarton className="block h-auto w-full" />
        <Highlight spot={active} label={fieldLabel} />
      </div>
      <figcaption className="flex h-10 items-center gap-1.5 border-t border-line px-4 text-[12.5px]">
        <Crosshair className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
        <span className="truncate">
          <b className="font-semibold text-ink">{fieldLabel}</b>
          <span className="text-ink-muted"> · Artwork · {spotLabel}</span>
        </span>
      </figcaption>
    </figure>
  );
}

function FieldRow({
  f,
  active,
  onActive,
  delay,
  writeKey,
  stack,
}: {
  f: ExampleField;
  active: boolean;
  onActive: () => void;
  delay: number;
  writeKey: number;
  stack?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseEnter={stack ? undefined : onActive}
      onFocus={onActive}
      onClick={onActive}
      aria-pressed={active}
      aria-label={`${f.label}: ${f.value}${f.unit ? ` ${f.unit}` : ""}. Show it on the example pack.`}
      className={cn(
        "group relative block w-full border-t border-line text-left transition-colors duration-200",
        stack ? "px-4 py-3.5" : "h-[104px] px-6 pt-4",
        active ? "bg-canary-soft/60" : "hover:bg-desk/60"
      )}
    >
      <span aria-hidden className={cn("absolute left-0 top-[26px] h-2 w-2 -translate-x-1/2 rounded-full border-2 border-ink bg-paper transition-transform duration-200", active ? "scale-100" : "scale-0", stack && "hidden")} />
      <span className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-semibold text-ink-muted">{f.label}</span>
        <span className="anim-stamp" style={{ animationDelay: `${delay}ms` }}>
          <StatusStamp status={f.status} />
        </span>
      </span>
      <span key={writeKey} className={cn("mt-1 flex items-baseline gap-2", writeKey > 0 && "anim-write")}>
        {f.figure ? (
          <>
            <span className="figure text-[34px] text-ink">{f.value}</span>
            <span className="text-[13px] font-semibold text-ink-2">{f.unit}</span>
          </>
        ) : (
          <span className="heading text-[18px] leading-snug text-ink [font-variation-settings:'opsz'_20,'wdth'_92]">{f.value}</span>
        )}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-muted">
        {f.proof.map((p, i) => (
          <span key={p} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-line-strong">/</span>}
            {i === 0 && <Crosshair className="h-3 w-3" aria-hidden />}
            <span className="underline decoration-ink/25 decoration-dotted underline-offset-2">{p}</span>
          </span>
        ))}
      </span>
    </button>
  );
}

function BriefSheet({
  fields,
  active,
  setActive,
  readiness,
  answered,
  writeKey,
  stack,
  className,
  style,
}: {
  fields: ExampleField[];
  active: Key;
  setActive: (k: Key) => void;
  readiness: number;
  answered: boolean;
  writeKey: number;
  stack?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section aria-label="Example brief" className={cn("sheet-set [--copy-1:#FFE3EA] [--copy-2:#E0ECFF]", className)} style={style}>
      <div className={cn("px-6", stack ? "py-4" : "h-[132px] pt-5")}>
        <div className="flex items-center justify-between gap-3">
          <p className="heading truncate text-[19px] text-ink">Northfield Oat Clusters</p>
          <MarketChip market="US" />
        </div>
        <div className="mt-3 flex items-end gap-4">
          <RollingNumber value={readiness} className="text-[48px] text-ink" suffix={<span className="text-[26px]">%</span>} label={`Example brief readiness ${readiness} percent`} />
          <div className="min-w-0 flex-1 pb-1.5">
            <ReadinessBar confirmed={(readiness * 0.8) / 100} review={readiness ? (answered ? 0.1 : 0.16) : 0} />
            <p className="meta mt-1.5">brief readiness · {answered ? "no questions open" : "1 question open"}</p>
          </div>
          <Stamp tone="stop" className="mb-1">
            1 blocking
          </Stamp>
        </div>
      </div>
      <div>
        {fields.map((f, i) => (
          <FieldRow
            key={f.key}
            f={f}
            active={active === f.key}
            onActive={() => setActive(f.key)}
            delay={1450 + i * 110}
            writeKey={f.key === "allergen" ? writeKey : 0}
            stack={stack}
          />
        ))}
      </div>
    </section>
  );
}

function FindingsCopy({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <section aria-label="Example findings" className={cn("rounded-lg border border-pink-deep/15 bg-pink-soft p-5 shadow-raised", className)} style={style}>
      <div className="flex items-baseline justify-between">
        <p className="heading text-[17px] text-ink">Findings</p>
        <p className="meta text-pink-deep">checked by code</p>
      </div>
      <div className="mt-3 space-y-2.5">
        <article className="rounded-md bg-paper p-3.5 shadow-sheet">
          <div className="flex items-center justify-between gap-2">
            <span className="anim-stamp" style={{ animationDelay: "1250ms" }}>
              <Stamp tone="stop">Blocking</Stamp>
            </span>
            <OwnerTag owner="R&D" />
          </div>
          <p className="mt-2 text-[13.5px] font-semibold leading-snug text-ink">Sodium %DV does not match the amount</p>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">140 mg is 6% of the 2,300 mg daily value; the panel prints 9%. Definite error.</p>
        </article>
        <article className="rounded-md bg-paper p-3.5 shadow-sheet">
          <div className="flex items-center justify-between gap-2">
            <span className="anim-stamp" style={{ animationDelay: "1380ms" }}>
              <Stamp tone="gold">Warning</Stamp>
            </span>
            <OwnerTag owner="Legal" />
          </div>
          <p className="mt-2 text-[13.5px] font-semibold leading-snug text-ink">“Good source of fiber” needs 2.8 g a serving</p>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">The panel shows 2 g. Likely problem.</p>
        </article>
      </div>
    </section>
  );
}

function QuestionsCopy({ answered, onAnswer, onReset, className, style }: { answered: boolean; onAnswer: () => void; onReset: () => void; className?: string; style?: React.CSSProperties }) {
  const [pick, setPick] = useState<"milk" | "keep">("milk");
  return (
    <section aria-label="Example question" className={cn("relative rounded-lg border border-canary-deep/15 bg-canary-soft p-5 shadow-raised", className)} style={style}>
      <div className="flex items-center justify-between gap-2">
        <p className="heading text-[17px] text-ink">Question</p>
        <OwnerTag owner="R&D" />
      </div>
      <p className="mt-2 text-[14px] font-semibold leading-snug text-ink">The sheet adds milk to the allergens. Does the new recipe contain milk?</p>
      <fieldset className="mt-3 space-y-1.5" disabled={answered}>
        <legend className="sr-only">Answer</legend>
        {(
          [
            ["milk", "Yes: print “Contains: almonds, milk”", "Sheet · B21"],
            ["keep", "No: keep “Contains: almonds”", "Artwork · Side"],
          ] as const
        ).map(([id, text, src]) => (
          <label
            key={id}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-md border bg-paper px-3 py-2 text-[12.5px] transition-[border-color,box-shadow] duration-150",
              pick === id ? "border-ink shadow-selected" : "border-line hover:border-line-strong"
            )}
          >
            <input type="radio" name="example-q" checked={pick === id} onChange={() => setPick(id)} className="mt-0.5 accent-[#15182B]" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{text}</span>
              <span className="text-ink-muted">{src}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-3 flex items-center justify-between gap-2">
        {answered ? (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 rounded-md px-1 text-[12.5px] font-semibold text-ink-2 underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Replay
          </button>
        ) : (
          <span className="text-[12px] text-ink-muted">Try it: the brief re-checks.</span>
        )}
        {answered ? (
          <span className="anim-stamp inline-block" role="status">
            <Stamp tone="ok" size="lg" tilt={-6} className="bg-mint-soft">
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Answered
            </Stamp>
          </span>
        ) : (
          <button
            type="button"
            onClick={onAnswer}
            disabled={pick !== "milk"}
            className="pressable inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-[12.5px] font-semibold text-white transition-opacity disabled:opacity-40"
            title={pick !== "milk" ? "In this example, the content sheet is right" : undefined}
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> Apply answer
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * The landing page's working example: the carbon set laid on the desk. Hover or focus a value on the
 * brief to trace it to its spot on the pack; answer the question and watch the brief re-check.
 */
export function PackPreview() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<Key>("allergen");
  const [answered, setAnswered] = useState(false);
  const [readiness, setReadiness] = useState(0);
  const [writeKey, setWriteKey] = useState(0);
  const [scale, setScale] = useState(1);
  // The first leader waits for the sheets to land; later ones draw at once.
  const [intro, setIntro] = useState(true);
  const pick = (k: Key) => {
    setIntro(false);
    setActive(k);
  };
  const stageWrap = useRef<HTMLDivElement | null>(null);
  const fields = fieldsFor(answered);
  const current = fields.find((f) => f.key === active)!;

  useEffect(() => {
    const t = window.setTimeout(() => setReadiness(64), reduce ? 0 : 1200);
    return () => window.clearTimeout(t);
  }, [reduce]);

  useLayoutEffect(() => {
    const el = stageWrap.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1.14, el.clientWidth / STAGE.w));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const answer = () => {
    setIntro(false);
    setAnswered(true);
    setActive("allergen");
    setWriteKey((k) => k + 1);
    setReadiness(71);
  };
  const reset = () => {
    setAnswered(false);
    setReadiness(64);
  };

  // The proof leader runs from the value on the brief to its spot on the pack.
  const [, sy0, sx1, sy1] = SPOTS[active];
  const ay = BRIEF.top + ORDER.indexOf(active) * BRIEF.row + 26;
  const ex = sx1 + 6;
  const ey = ART.y + ART.header + (sy0 + sy1) / 2;
  const leader = `M ${BRIEF.x} ${ay} C ${BRIEF.x - 70} ${ay}, ${ex + 60} ${ey}, ${ex} ${ey}`;

  return (
    <div>
      {/* Desktop: the set laid out on the desk at its designed size, scaled to fit */}
      <div ref={stageWrap} className="relative hidden lg:block" style={{ height: STAGE.h * scale }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: STAGE.w, height: STAGE.h, transform: `scale(${scale})` }}>
          <ArtworkSheet
            active={active}
            fieldLabel={current.label}
            spotLabel={current.spotLabel}
            className="anim-sheet absolute z-[1] w-[430px]"
            style={{ left: ART.x, top: ART.y, animationDelay: "150ms", ["--sheet-r" as string]: "-0.6deg", transform: "rotate(-0.6deg)" }}
          />
          <svg className="pointer-events-none absolute inset-0 z-[2]" width={STAGE.w} height={STAGE.h} aria-hidden>
            <path key={`${active}-${answered}`} d={leader} pathLength={1} fill="none" stroke="#15182B" strokeWidth="1.75" className="anim-draw" style={{ animationDelay: intro && !reduce ? "1100ms" : "0ms", animationDuration: intro ? "700ms" : "380ms" }} />
            <circle cx={ex} cy={ey} r="3.5" fill="#15182B" />
          </svg>
          <FindingsCopy className="anim-sheet absolute z-[2] w-[336px]" style={{ left: 866, top: 36, animationDelay: "620ms", ["--sheet-r" as string]: "2deg", transform: "rotate(2deg)" }} />
          <BriefSheet
            fields={fields}
            active={active}
            setActive={pick}
            readiness={readiness}
            answered={answered}
            writeKey={writeKey}
            className="anim-sheet absolute z-[3] w-[470px]"
            style={{ left: BRIEF.x, top: 0, height: 560, animationDelay: "380ms" }}
          />
          <QuestionsCopy
            answered={answered}
            onAnswer={answer}
            onReset={reset}
            className="anim-sheet absolute z-[4] w-[340px]"
            style={{ left: 862, top: 330, animationDelay: "800ms", ["--sheet-r" as string]: "-1.4deg", transform: "rotate(-1.4deg)" }}
          />
        </div>
      </div>

      {/* Phones and tablets: the same set, stacked */}
      <div className="space-y-4 lg:hidden">
        <div className="grid gap-4 sm:grid-cols-2">
          <ArtworkSheet active={active} fieldLabel={current.label} spotLabel={current.spotLabel} className="anim-sheet" style={{ animationDelay: "120ms" }} />
          <BriefSheet
            fields={fields}
            active={active}
            setActive={pick}
            readiness={readiness}
            answered={answered}
            writeKey={writeKey}
            stack
            className="anim-sheet"
            style={{ animationDelay: "260ms" }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FindingsCopy className="anim-sheet" style={{ animationDelay: "380ms" }} />
          <QuestionsCopy answered={answered} onAnswer={answer} onReset={reset} className="anim-sheet" style={{ animationDelay: "480ms" }} />
        </div>
      </div>
    </div>
  );
}
