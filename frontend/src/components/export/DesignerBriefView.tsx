"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BriefState, DesignAction, DesignerBrief, PageView, Panel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArtworkViewer } from "@/components/shared/ArtworkViewer";
import { ACTION_META, ActionFlag, OwnerTag, StatusFlag } from "@/components/shared/badges";

const ORDER: DesignAction[] = ["change", "add", "remove", "unknown", "keep"];

function Section({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24">
      <div className="section-rule mb-4">
        <h2 id={id} className="text-[20px] font-extrabold text-ink [font-stretch:87.5%]">
          {title}
        </h2>
        {aside && <span className="text-xs text-ink-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Fold({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded border border-line">
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
    <div className="w-full max-w-[320px] border-2 border-ink bg-stock p-2 font-sans text-ink">
      <p className="text-[34px] font-black leading-none tracking-[-0.02em] [font-stretch:87.5%]">Nutrition Facts</p>
      <div className="my-1 border-b border-ink" />
      <p className="text-[14px]">{servings ? `${servings} servings per container` : "Servings per container: to confirm"}</p>
      <p className="flex justify-between text-[16px] font-black">
        <span>Serving size</span>
        <span className={cn(pending(state.fields.find((f) => f.key === "serving_size")?.status) && "bg-talker px-1")}>{serving ?? "—"}</span>
      </p>
      <div className="my-1 h-2.5 bg-ink" />
      <p className="text-[11px] font-bold">Amount per serving</p>
      <p className="flex items-end justify-between leading-none">
        <span className="text-[28px] font-black">Calories</span>
        <span className={cn("text-[36px] font-black", pending(cal?.status) && "bg-talker px-1")}>{cal?.amount ?? "—"}</span>
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
            pending(n.status) && "bg-talker-soft"
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

export function DesignerBriefView({ brief, state, pages, panels }: { brief: DesignerBrief; state: BriefState; pages: PageView[]; panels: Panel[] }) {
  const [action, setAction] = useState<DesignAction | "all">("all");
  const panelActions: Record<string, DesignAction[]> = {};
  brief.panels.forEach((p) => (panelActions[p.panel] = p.items.map((i) => i.action)));
  const items = brief.items.filter((i) => action === "all" || i.action === action);
  const panelLabel = (id?: string | null) => panels.find((p) => p.id === id)?.label ?? (id ? id.replace(/_/g, " ") : "Whole pack");
  const pendingNutrition = brief.nutrition.filter((n) => n.status !== "confirmed").length;
  const owners = Array.from(new Set(brief.open_questions.map((q) => q.owner)));

  return (
    <article className="ticket mx-auto max-w-[1240px] space-y-10 px-5 py-7 md:px-10 md:py-10">
      {/* Title block */}
      <header className="grid grid-cols-1 gap-6 border-b-[6px] border-rail pb-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h1 className="text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink [font-stretch:80%]">{brief.product}</h1>
          <ul className="mt-3 space-y-1 text-[15px] text-ink-2">
            {brief.summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-2 text-[13px] lg:w-80">
          <dt className="text-ink-muted">Document</dt>
          <dd className="font-semibold text-ink">Packaging design brief</dd>
          <dt className="text-ink-muted">Market</dt>
          <dd className="font-semibold text-ink">{brief.market}</dd>
          <dt className="text-ink-muted">Situation</dt>
          <dd className="font-semibold text-ink">{brief.case}</dd>
          <dt className="text-ink-muted">Status</dt>
          <dd className="font-semibold capitalize text-ink">{brief.status}</dd>
          <dt className="text-ink-muted">Updated</dt>
          <dd className="text-xs tabular-nums text-ink">{brief.updated_at.slice(0, 16).replace("T", " ")} UTC</dd>
          <dt className="text-ink-muted">Readiness</dt>
          <dd className="figure text-[24px] text-ink">{brief.readiness?.score ?? 0}%</dd>
        </dl>
      </header>

      <Section id="todo-h" title="What to do on the pack" aside="Filter by action; the layout shows each panel’s count">
        <div role="tablist" aria-label="Filter by action" className="mb-4 flex flex-wrap gap-2">
          <button
            role="tab"
            aria-selected={action === "all"}
            onClick={() => setAction("all")}
            className={cn("h-9 rounded border px-3 text-[13px] font-semibold", action === "all" ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink")}
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
                  "inline-flex h-9 items-center gap-2 rounded border pl-1 pr-3 text-[13px] font-semibold transition-colors disabled:opacity-40",
                  action === a ? "border-ink bg-ground shadow-[inset_0_0_0_1px_#121514]" : "border-line hover:border-ink"
                )}
              >
                <ActionFlag action={a} />
                <b className="figure text-[19px]">{n}</b>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start print:static">
            <ArtworkViewer pages={pages} panels={panels} panelActions={panelActions} height="max-h-[460px]" />
            <p className="mt-2 text-xs text-ink-muted">Annotated layout: each panel shows how many items change, are added, removed or kept there.</p>
          </div>
          <ol className="space-y-2" aria-label="Design actions">
            {items.map((i, k) => (
              <li key={`${i.item}-${k}`} className="ticket anim-rise overflow-hidden" style={{ animationDelay: `${Math.min(k, 10) * 25}ms` }}>
                <div className="flex items-start justify-between gap-3 pr-4 pt-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ActionFlag action={i.action} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold leading-snug text-ink">{i.item}</p>
                      <p className="meta text-ink-muted">{panelLabel(i.panel)}</p>
                    </div>
                  </div>
                  {i.owner && <OwnerTag owner={i.owner} className="shrink-0" />}
                </div>
                <div className="space-y-2 px-4 pb-3 pt-2 text-[13px] leading-relaxed text-ink-2">
                  <p>{i.instruction}</p>
                  {i.action === "change" && i.current && (
                    <div className="grid gap-1 rounded bg-ground p-2.5 text-[13px]">
                      <p>
                        <span className="mr-2 meta text-ink-muted">Now</span>
                        <span className="text-ink-muted line-through decoration-stop/70">{i.current}</span>
                      </p>
                      <p>
                        <span className="mr-2 meta text-rail">Use</span>
                        <span className="font-semibold text-ink">{i.new}</span>
                      </p>
                    </div>
                  )}
                  {i.action === "add" && i.new && (
                    <p className="rounded bg-ok-soft p-2.5 font-semibold text-ink">
                      <span className="mr-2 meta text-rail">Add</span>
                      {i.new}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Section id="copy-h" title="Approved copy" aside="Mandatory content, as it should print">
          <dl className="divide-y divide-line border-y border-line">
            {brief.final_copy.map((c) => (
              <div key={c.field} className="grid grid-cols-1 gap-1 py-3 md:grid-cols-[180px_minmax(0,1fr)_auto] md:gap-4">
                <dt className="text-[13px] font-bold text-ink">{c.label}</dt>
                <dd className="text-[14px] leading-relaxed text-ink">{c.value ?? <i className="text-ink-faint">Not provided yet</i>}</dd>
                <dd className="md:-mr-1">
                  <StatusFlag status={c.status} />
                </dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section id="nf-h" title="Nutrition Facts" aside={pendingNutrition ? `${pendingNutrition} to confirm` : "all confirmed"}>
          <NutritionPanel brief={brief} state={state} />
          {pendingNutrition > 0 && (
            <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
              <span className="inline-block h-3 w-5 bg-talker-soft ring-1 ring-talker" aria-hidden /> Highlighted values still need confirmation.
            </p>
          )}
        </Section>
      </div>

      <Section id="oq-h" title="Open questions for the agency" aside={`${brief.open_questions.length} item${brief.open_questions.length === 1 ? "" : "s"}`}>
        {brief.open_questions.length === 0 ? (
          <p className="text-[14px] text-ink-muted">None. Every decision has been made.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {owners.map((o) => (
              <div key={o}>
                <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink">
                  For <OwnerTag owner={o} />
                </p>
                <ol className="space-y-2">
                  {brief.open_questions
                    .filter((q) => q.owner === o)
                    .map((q) => (
                      <li key={q.issue_id} className="rounded bg-ground p-3">
                        <p className="text-[14px] font-bold leading-snug text-ink">{q.question}</p>
                        <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-ink-muted">{q.detail}</p>
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="space-y-3">
        <Fold title="Proof: where every value came from" count={brief.proof.length}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="bg-ground text-[11px] uppercase tracking-wider text-ink-muted">
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
                      <StatusFlag status={p.status} />
                    </td>
                    <td className="px-4 py-2 font-mono text-code text-ink-muted">
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
              <li key={i} className="grid grid-cols-[120px_1fr] gap-3 border-b border-line/70 py-1.5 text-xs last:border-0">
                <span className="text-xs tabular-nums text-ink-muted">{c.at.slice(0, 16).replace("T", " ")}</span>
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

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-ink-muted">
        <span>Prepared with BriefForge. AI reads and suggests. Code checks. Humans decide.</span>
        <span className="flex items-center gap-1.5">
          Legend: {ORDER.map((a) => (
            <span key={a} className={cn("rounded-sm px-1 text-[10px] font-bold uppercase", ACTION_META[a].cls)}>
              {ACTION_META[a].text}
            </span>
          ))}
        </span>
      </footer>
    </article>
  );
}
