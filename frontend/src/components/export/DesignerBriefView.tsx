"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { AgencySimulatorButton } from "@/components/export/AgencySimulator";
import { DielineBlueprint } from "@/components/export/DielineBlueprint";
import { BriefState, DesignAction, DesignerBrief, OpenQuestion, PageView, Panel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArtworkViewer } from "@/components/shared/ArtworkViewer";
import { ACTION_META, ActionStamp, OwnerTag, StatusStamp } from "@/components/shared/badges";
import { SearchBox, matchesQuery } from "@/components/shared/SearchBox";
import { useBriefStore } from "@/store/briefStore";

const ORDER: DesignAction[] = ["change", "add", "remove", "unknown", "keep"];

/** Dates are shown in the reader's own time, as on the Projects page. */
function local(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 16).replace("T", " ") : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** One part of the brief, as its own card, so the page reads as parts and not as one long sheet. */
function Section({ id, title, aside, children, className }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={`sec-${id}`} aria-labelledby={`${id}-h`} className={cn("sheet scroll-mt-[calc(var(--stick-top,_130px)_+_8px)] p-5 md:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-h`} className="heading text-[22px] text-ink">
          {title}
        </h2>
        {aside && <span className="text-[13px] text-ink-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Fold({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg border border-line">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="text-[15px] font-bold text-ink">
          {title} <b className="figure ml-1 text-[18px]">{count}</b>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-ink-faint transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div className="disclosure" data-open={open}>
        <div>
          <div className="border-t border-line">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Copies one approved value, so the agency can paste it straight into the artwork file. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 1600);
    return () => window.clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => setDone(true)).catch(() => {})}
      aria-label={`Copy ${label}`}
      title={done ? "Copied" : "Copy"}
      className={cn("no-print grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-colors", done ? "border-mint-deep bg-mint-soft text-mint-deep" : "border-line text-ink-muted hover:border-ink hover:text-ink")}
    >
      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** The approved values set as a US Nutrition Facts panel, the way the agency will lay it out. */
function NutritionPanel({ brief, state }: { brief: DesignerBrief; state: BriefState }) {
  const servings = state.fields.find((f) => f.key === "servings_per_package")?.value;
  const serving = state.fields.find((f) => f.key === "serving_size")?.value;
  const cal = brief.nutrition.find((n) => n.label === "Calories");
  const rows = brief.nutrition.filter((n) => n.label !== "Calories");
  const indented = new Set(["Saturated Fat", "Trans Fat", "Dietary Fiber", "Total Sugars", "Added Sugars"]);
  const minerals = new Set(["Vitamin D", "Calcium", "Iron", "Potassium"]);
  const pending = (st?: string) => st && st !== "confirmed";
  return (
    <div className="w-full max-w-[320px] border-2 border-ink bg-paper p-2 font-sans text-ink">
      <p className="text-[34px] font-black leading-none tracking-[-0.02em] [font-family:var(--font-display)] [font-variation-settings:'wdth'_80]">Nutrition Facts</p>
      <div className="my-1 border-b border-ink" />
      <p className="text-[14px]">{servings ? `${servings} servings per container` : "Servings per container: to confirm"}</p>
      <p className="flex justify-between text-[16px] font-black">
        <span>Serving size</span>
        <span className={cn(pending(state.fields.find((f) => f.key === "serving_size")?.status) && "bg-canary px-1")}>{serving ?? "—"}</span>
      </p>
      <div className="my-1 h-2.5 bg-ink" />
      <p className="text-[11px] font-bold">Amount per serving</p>
      <p className="flex items-end justify-between leading-none">
        <span className="text-[28px] font-black">Calories</span>
        <span className={cn("text-[36px] font-black", pending(cal?.status) && "bg-canary px-1")}>{cal?.amount ?? "—"}</span>
      </p>
      <div className="my-1 h-1.5 bg-ink" />
      <p className="text-right text-[11px] font-bold">% Daily Value*</p>
      {rows.map((n) => (
        <div
          key={n.label}
          className={cn(
            "flex justify-between border-t border-ink/60 py-0.5 text-[13px]",
            n.label === "Vitamin D" && "border-t-[8px] border-ink",
            indented.has(n.label) && "pl-4",
            pending(n.status) && "bg-canary-soft"
          )}
        >
          <span>
            <span className={cn(!indented.has(n.label) && !minerals.has(n.label) && "font-black")}>{n.label}</span> {n.amount ?? "—"}
          </span>
          <span className="font-black">{n.dv ?? ""}</span>
        </div>
      ))}
      <div className="mt-0.5 h-1.5 bg-ink" />
      <p className="mt-1 text-[9.5px] leading-tight">
        * The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.
      </p>
    </div>
  );
}

const PASSED_TEXT: Record<string, string> = { agency: "Passed to the agency", check: "Check on the pack" };

/** One group of open questions, set out by owner, as in section 3 of the PDF. */
function QuestionGroup({ id, title, lead, questions }: { id: string; title: string; lead: string; questions: OpenQuestion[] }) {
  const owners = Array.from(new Set(questions.map((q) => q.owner))).sort();
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-[16px] font-bold text-ink">
        {title} <b className="figure ml-1 text-[18px]">{questions.length}</b>
      </h3>
      <p className="mb-3 text-[13px] text-ink-muted">{lead}</p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {owners.map((o) => (
          <div key={o}>
            <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink">
              For <OwnerTag owner={o} />
            </p>
            <ol className="space-y-2">
              {questions
                .filter((q) => q.owner === o)
                .map((q) => (
                  <li key={q.issue_id} className="rounded-md bg-desk p-3">
                    <p className="text-[14px] font-bold leading-snug text-ink">{q.question}</p>
                    {q.status !== "open" && <p className="meta mt-1 text-ink-muted">{PASSED_TEXT[q.status] ?? q.status}</p>}
                    <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-ink-muted">
                      {q.status === "agency" ? q.detail.split(" — ").slice(-1)[0] : q.detail}
                    </p>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DesignerBriefView({
  brief,
  state,
  pages,
  panels,
  downloads,
}: {
  brief: DesignerBrief;
  state: BriefState;
  pages: PageView[];
  panels: Panel[];
  /** The download buttons, shown under the section list so they are always in reach. */
  downloads?: React.ReactNode;
}) {
  const [action, setAction] = useState<DesignAction | "all">("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("overview");
  const sessionId = useBriefStore((s) => s.sessionId);
  const panelActions: Record<string, DesignAction[]> = {};
  brief.panels.forEach((p) => (panelActions[p.panel] = p.items.map((i) => i.action)));
  const inFilter = brief.items.filter((i) => action === "all" || i.action === action);
  const items = inFilter.filter((i) => matchesQuery(query, i.item, i.instruction));
  const searching = query.trim().length > 0;
  const panelLabel = (id?: string | null) => panels.find((p) => p.id === id)?.label ?? (id ? id.replace(/_/g, " ") : "Whole pack");
  const pendingNutrition = brief.nutrition.filter((n) => n.status !== "confirmed").length;
  const waiting = brief.open_questions.filter((q) => q.status === "open");
  const passed = brief.open_questions.filter((q) => q.status !== "open");
  const decisions = brief.decisions ?? [];

  // The section list, with what is in each, so the reader can see the shape of the brief before reading it.
  const nav: { id: string; label: string; count?: number; flag?: boolean }[] = [
    { id: "overview", label: "Overview" },
    ...(sessionId ? [{ id: "blueprint", label: "Visual blueprint" }] : []),
    { id: "todo", label: "What to do on the pack", count: brief.items.length },
    { id: "copy", label: "Approved copy", count: brief.final_copy.length },
    ...(brief.nutrition.length > 0 ? [{ id: "nf", label: "Nutrition Facts", count: pendingNutrition || undefined, flag: pendingNutrition > 0 }] : []),
    { id: "oq", label: "Open questions", count: waiting.length || undefined, flag: waiting.length > 0 },
    ...(decisions.length > 0 ? [{ id: "dec", label: "Decisions", count: decisions.length }] : []),
    { id: "proof", label: "Proof and change log" },
  ];

  // Follow the reader down the page: the section nearest the top of the window is the active one.
  useEffect(() => {
    const els = nav.map((n) => document.getElementById(`sec-${n.id}`)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id.replace("sec-", ""));
      },
      { rootMargin: "-25% 0px -60% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.length]);

  const go = (id: string) => {
    setActive(id);
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const pick = (a: DesignAction | "all") => {
    setAction(a);
    go("todo");
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:gap-8">
      {/* Where you are in the brief; the downloads stay in reach underneath */}
      <aside className="no-print min-w-0 lg:sticky lg:top-[var(--stick-top,_130px)] lg:max-h-[calc(100vh_-_var(--stick-top,_130px)_-_16px)] lg:overflow-y-auto">
        <nav aria-label="Sections of the brief" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
          {nav.map((n) => {
            const on = active === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                aria-current={on ? "location" : undefined}
                className={cn(
                  "flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[13.5px] font-semibold transition-colors duration-150 lg:w-full",
                  on ? "bg-ink text-white" : "border border-line bg-paper text-ink-2 hover:border-ink hover:text-ink lg:border-transparent lg:bg-transparent lg:hover:bg-paper"
                )}
              >
                <span className="whitespace-nowrap">{n.label}</span>
                {n.count !== undefined && (
                  <span className={cn("figure text-[16px]", on ? "text-canary" : n.flag ? "text-stop-deep" : "text-ink-muted")}>{n.count}</span>
                )}
              </button>
            );
          })}
        </nav>
        {downloads && <div className="mt-4 hidden space-y-2 border-t border-line pt-4 lg:block">{downloads}</div>}
      </aside>

      <div className="min-w-0 space-y-5">
        {/* Overview: what this brief is, and what it asks of the agency, one tap from the detail */}
        <Section id="overview" title={brief.product}>
          <div className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <ul className="space-y-2 text-[15px] leading-relaxed text-ink-2">
              {brief.summary.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 rounded-lg bg-desk px-4 py-3 text-[13px]">
              <dt className="text-ink-muted">Market</dt>
              <dd className="font-semibold text-ink">{brief.source_market ? `${brief.source_market} → ${brief.market}` : brief.market}</dd>
              <dt className="text-ink-muted">Situation</dt>
              <dd className="font-semibold text-ink">{brief.case}</dd>
              <dt className="text-ink-muted">Status</dt>
              <dd className="font-semibold capitalize text-ink">{brief.status}</dd>
              <dt className="text-ink-muted">Updated</dt>
              <dd className="tabular-nums text-ink">{local(brief.updated_at)}</dd>
              <dt className="text-ink-muted">Readiness</dt>
              <dd className="figure text-[22px] leading-none text-ink">{brief.readiness?.score ?? 0}%</dd>
            </dl>
          </div>
          <div className="no-print mt-5">
            <p className="mb-2 text-[12.5px] font-semibold text-ink-muted">What the agency has to do. Tap one to see those items.</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {ORDER.map((a) => {
                const n = brief.items.filter((i) => i.action === a).length;
                return (
                  <button
                    key={a}
                    type="button"
                    disabled={!n}
                    onClick={() => pick(a)}
                    className="group rounded-lg border border-line bg-paper p-3 text-left transition-[border-color,box-shadow] duration-150 hover:border-ink hover:shadow-selected disabled:opacity-45 disabled:hover:border-line disabled:hover:shadow-none"
                  >
                    <ActionStamp action={a} />
                    <span className="figure mt-2 block text-[38px] leading-none text-ink">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {sessionId && (
          <Section id="blueprint" title="Visual blueprint" aside={<AgencySimulatorButton sessionId={sessionId} />} className="no-print">
            <DielineBlueprint sessionId={sessionId} version={brief.updated_at} />
          </Section>
        )}

        <Section id="todo" title="What to do on the pack" aside={action === "all" ? "Filter by action; the layout shows each panel’s count" : `Showing ${ACTION_META[action].text.toLowerCase()} items`}>
          <div role="tablist" aria-label="Filter by action" className="mb-4 flex flex-wrap gap-2">
            <button
              role="tab"
              aria-selected={action === "all"}
              onClick={() => setAction("all")}
              className={cn("h-9 rounded-md border px-3 text-[13px] font-semibold", action === "all" ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink")}
            >
              All <b className="figure ml-1 text-[17px]">{brief.items.length}</b>
            </button>
            {ORDER.map((a) => {
              const n = brief.items.filter((i) => i.action === a).length;
              return (
                <button
                  key={a}
                  role="tab"
                  aria-selected={action === a}
                  disabled={!n}
                  onClick={() => setAction(a)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md border pl-1 pr-3 text-[13px] font-semibold transition-colors disabled:opacity-40",
                    action === a ? "border-ink bg-desk shadow-selected" : "border-line hover:border-ink"
                  )}
                >
                  <ActionStamp action={a} />
                  <b className="figure text-[19px]">{n}</b>
                </button>
              );
            })}
          </div>
          <div className="no-print mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SearchBox
              id="design-item-search"
              label="Search design actions"
              value={query}
              onChange={setQuery}
              placeholder="Search item or instruction"
              count={items.length}
              noun={["item", "items"]}
              className="w-full max-w-sm"
            />
            {searching && (
              <p className="text-xs text-ink-muted" aria-hidden>
                Showing {items.length} of {inFilter.length}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="min-w-0 xl:sticky xl:top-[calc(var(--stick-top,_130px)_+_8px)] print:static">
              <ArtworkViewer pages={pages} panels={panels} panelActions={panelActions} height="max-h-[460px]" />
              <p className="mt-2 text-xs text-ink-muted">Annotated layout: each panel shows how many items change, are added, removed or kept there.</p>
            </div>
            <ol className="min-w-0 space-y-2.5" aria-label="Design actions">
              {items.length === 0 && (
                <li className="rounded-md border border-dashed border-line-strong p-6 text-center">
                  <p className="text-[14px] font-semibold text-ink">{searching ? `No item matches “${query.trim()}”.` : "No item in this view."}</p>
                  {searching && (
                    <button onClick={() => setQuery("")} className="mt-2 text-[13px] font-semibold text-ink underline decoration-1 hover:decoration-2">
                      Clear search
                    </button>
                  )}
                </li>
              )}
              {items.map((i, k) => (
                <li key={`${i.item}-${k}`} className="sheet anim-rise overflow-hidden" style={{ animationDelay: `${Math.min(k, 10) * 25}ms` }}>
                  <div className="flex items-start justify-between gap-3 pr-4 pt-3.5">
                    <div className="flex min-w-0 items-start gap-3">
                      <ActionStamp action={i.action} className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold leading-snug text-ink">{i.item}</p>
                        <p className="meta text-ink-muted">{panelLabel(i.panel)}</p>
                      </div>
                    </div>
                    {i.owner && <OwnerTag owner={i.owner} className="shrink-0" />}
                  </div>
                  <div className="space-y-2 px-4 pb-3.5 pt-2 text-[13.5px] leading-relaxed text-ink-2">
                    <p>{i.instruction}</p>
                    {i.action === "change" && i.current && (
                      <div className="grid gap-1 rounded-md bg-desk p-2.5 text-[13px]">
                        <p>
                          <span className="mr-2 meta text-ink-muted">Now</span>
                          <span className="text-ink-muted line-through decoration-ink/40">{i.current}</span>
                        </p>
                        <p>
                          <span className="mr-2 meta text-ink">Use</span>
                          <span className="font-semibold text-ink">{i.new}</span>
                        </p>
                      </div>
                    )}
                    {i.action === "add" && i.new && (
                      <p className="rounded-md bg-mint-soft p-2.5 font-semibold text-ink">
                        <span className="mr-2 meta text-ink">Add</span>
                        {i.new}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Section>

        <div className={cn("grid grid-cols-1 items-start gap-5", brief.nutrition.length > 0 && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
          <Section id="copy" title="Approved copy" aside="Mandatory content, as it should print">
            <dl className="divide-y divide-line border-y border-line">
              {brief.final_copy.map((c) => (
                <div key={c.field} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 py-3.5 md:grid-cols-[170px_minmax(0,1fr)_auto_auto] md:gap-x-4">
                  <dt className="col-span-2 text-[13px] font-bold text-ink md:col-span-1">{c.label}</dt>
                  <dd className="min-w-0 text-[15px] leading-relaxed text-ink [overflow-wrap:anywhere]">{c.value ?? <i className="text-ink-faint">Not provided yet</i>}</dd>
                  <dd className="md:order-none">
                    <StatusStamp status={c.status} />
                  </dd>
                  <dd className="hidden md:block">{c.value ? <CopyButton text={c.value} label={c.label} /> : <span className="block h-8 w-8" />}</dd>
                </div>
              ))}
            </dl>
          </Section>
          {brief.nutrition.length > 0 && (
            <Section id="nf" title="Nutrition Facts" aside={pendingNutrition ? `${pendingNutrition} to confirm` : "all confirmed"}>
              <div className="flex justify-center">
                <NutritionPanel brief={brief} state={state} />
              </div>
              {pendingNutrition > 0 && (
                <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                  <span className="inline-block h-3 w-5 bg-canary-soft ring-1 ring-canary-deep" aria-hidden /> Highlighted values still need confirmation.
                </p>
              )}
            </Section>
          )}
        </div>

        <Section id="oq" title="Open questions" aside={`${waiting.length} to decide · ${passed.length} passed on`}>
          {brief.open_questions.length === 0 ? (
            <p className="text-[14px] text-ink-muted">None. Every decision has been made.</p>
          ) : (
            <div className="space-y-8">
              {waiting.length > 0 ? (
                <QuestionGroup id="oq-open-h" title="Still to decide" lead="Decisions the brief is still waiting on." questions={waiting} />
              ) : (
                <p className="text-[14px] text-ink-muted">Nothing is waiting. Every decision is made or passed to the agency.</p>
              )}
              {passed.length > 0 && (
                <QuestionGroup
                  id="oq-passed-h"
                  title="Passed to the agency or to check on the pack"
                  lead="Not blocking. The agency resolves these, or checks them on the printed proof."
                  questions={passed}
                />
              )}
            </div>
          )}
        </Section>

        {decisions.length > 0 && (
          <Section id="dec" title="Decisions made during review" aside={`${decisions.length} answered`}>
            <ol className="divide-y divide-line/70 border-y border-line">
              {decisions.map((d, i) => (
                <li key={i} className="grid grid-cols-1 gap-x-4 gap-y-1 py-3 text-[13.5px] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <p className="font-semibold leading-snug text-ink">{d.question}</p>
                  <p className="leading-snug text-ink-2">
                    <span className="sr-only">Answer: </span>
                    {d.answer}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-ink-muted md:justify-end">
                    <OwnerTag owner={d.owner} />
                    <span className="tabular-nums">
                      {d.by} · {local(d.at)}
                    </span>
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        )}

        <Section id="proof" title="Proof and change log" aside="Where every value came from, and what changed">
          <div className="space-y-3">
            <Fold title="Proof: where every value came from" count={brief.proof.length}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead className="bg-desk text-[11px] uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Field</th>
                      <th className="px-4 py-2 font-semibold">Value</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold">Sources</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {brief.proof.map((p) => (
                      <tr key={p.field} className="align-top">
                        <td className="px-4 py-2 font-semibold text-ink">{p.label}</td>
                        <td className="max-w-[320px] px-4 py-2 text-ink">{p.value ?? "—"}</td>
                        <td className="px-4 py-2">
                          <StatusStamp status={p.status} />
                        </td>
                        <td className="px-4 py-2 text-[12px] tabular-nums text-ink-muted">
                          {p.sources.map((s, i) => (
                            <div key={i}>{s}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Fold>
            <Fold title="Change log" count={brief.change_log.length}>
              <ol className="px-4 py-2">
                {brief.change_log.map((c, i) => (
                  <li key={i} className="grid grid-cols-[110px_1fr] gap-3 border-b border-line/70 py-2 text-[12.5px] last:border-0">
                    <span className="tabular-nums text-ink-muted">{local(c.at)}</span>
                    <span className="text-ink-2">
                      <b className="text-ink">{c.by}</b> · {c.action} {c.field ?? c.issue ?? ""}
                      {c.new != null && <> → “{c.new}”</>}
                      {c.note && <span className="text-ink-muted"> · {c.note}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </Fold>
          </div>
        </Section>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 text-xs text-ink-muted">
          <span>Prepared with PackProofAI. AI reads and suggests. Code checks. Humans decide.</span>
          <span className="flex items-center gap-1.5">
            Legend:{" "}
            {ORDER.map((a) => (
              <span key={a} className={cn("rounded-sm px-1 text-[10px] font-bold uppercase", ACTION_META[a].cls)}>
                {ACTION_META[a].text}
              </span>
            ))}
          </span>
        </footer>
      </div>
    </div>
  );
}
