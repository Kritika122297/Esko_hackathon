"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookCheck, Check, ChevronDown, Globe2, PackagePlus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutopilotTimeline } from "@/components/upload/AutopilotTimeline";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { Stamp } from "@/components/shared/badges";
import { ErrorBanner, PageHead, fmtElapsed } from "@/components/shared/Notice";
import { ApiError, api } from "@/lib/api";
import { CaseType, ChecklistField, PRODUCT_CATEGORIES, RulebookProposal, RulesSummary, StandardsOptions } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

const CASES: { id: CaseType; title: string; text: string; effect: string; icon: typeof RefreshCw }[] = [
  {
    id: "update",
    title: "Refresh an existing pack",
    text: "Current artwork plus content sheet. Compare them and update.",
    effect: "Where the artwork and the sheet disagree, you are asked which is right.",
    icon: RefreshCw,
  },
  {
    id: "new_market",
    title: "Adapt to a new market",
    text: "An existing pack from another country, made ready for this one.",
    effect: "The new market's sheet wins; differences from the old pack become design changes. Copy only the old pack has is checked with you.",
    icon: Globe2,
  },
  {
    id: "new_product",
    title: "New product",
    text: "Spec sheet or notes only; there is no artwork yet.",
    effect: "Any artwork is a reference only: its text is not used and every item is new copy to place.",
    icon: PackagePlus,
  },
];

const STAGES = [
  ["Read", "Text with positions, panel grid, hidden layers, sheet cells and notes"],
  ["Fill", "Every brief field from a real source; nothing invented"],
  ["Check", "Math, claims, files against each other, and the label rules for the chosen market and category"],
  ["Ask", "Only the decisions that matter, routed by owner"],
];

const OTHER = "OTHER";
const SECTION_ORDER = ["Product", "Legal & Identity", "Ingredients & Allergens", "Claims & Certifications", "Quantity", "Nutrition", "Other Pack Copy", "Project"];

const SELECT = "h-11 w-full rounded-md border border-line-strong bg-paper px-3 text-[14px] font-medium text-ink transition-colors hover:border-ink-soft focus:border-ink";

/** A numbered step heading: the setup is a real sequence, so the numbers carry meaning. */
function StepHead({ n, title, aside, id }: { n: number; title: string; aside?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 id={id} className="heading flex items-center gap-3 text-[20px] text-ink">
        <span className="figure grid h-7 w-7 place-items-center rounded-md bg-ink text-[16px] text-white" aria-hidden>
          {n}
        </span>
        {title}
      </h2>
      {aside && <span className="text-[13px] text-ink-muted">{aside}</span>}
    </div>
  );
}

/** Which label rules will be applied, and how far they can be trusted. */
function RulesBox({ rules, marketLabel }: { rules: RulesSummary | null; marketLabel: string }) {
  if (!rules) return null;
  return (
    <div className="rounded-lg border border-line bg-desk/50 p-4 text-[13.5px]" aria-live="polite">
      {rules.market_rules ? (
        <>
          <p className="font-semibold text-ink">Rules that will be applied for {marketLabel}</p>
          <ul className="mt-2.5 space-y-2">
            {rules.packs.map((p) => (
              <li key={p.standard} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-paper px-3 py-2 shadow-sheet">
                <span className="min-w-0 text-ink-2">
                  <b className="font-semibold text-ink">{p.name}</b> <span className="text-ink-muted">· {p.clauses} rules</span>
                </span>
                {p.status === "verified" ? (
                  <Stamp tone="ok">Verified</Stamp>
                ) : (
                  <Stamp tone="review" title="Not yet checked against the official text">
                    Draft
                  </Stamp>
                )}
              </li>
            ))}
          </ul>
          {rules.packs.some((p) => p.status !== "verified") && (
            <p className="mt-2.5 text-[12.5px] text-ink-muted">Draft rule packs have not yet been checked against the official text.</p>
          )}
        </>
      ) : (
        <p className="text-ink-2">
          <b className="text-ink">No label rules are loaded for {marketLabel} yet.</b> Only the general checks run: math, files against each other, claims, and the core brief fields.
        </p>
      )}
    </div>
  );
}

/** A section that opens and closes in place, used for the optional parts of the setup. */
function Fold({ title, aside, open, onToggle, children, id }: { title: string; aside?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode; id: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
        <span className="min-w-0 text-[14px] font-semibold text-ink">
          {title} {aside && <span className="font-normal text-ink-muted">{aside}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ease-out", open && "rotate-180")} aria-hidden />
      </button>
      <div id={id} className="disclosure" data-open={open} aria-hidden={!open}>
        <div>
          <div className="border-t border-line px-4 pb-4 pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** For a new product: what the team needs to provide, by section, before any file is read. */
function ChecklistBox({ fields }: { fields: ChecklistField[] }) {
  const [open, setOpen] = useState(true);
  const sections = useMemo(
    () => SECTION_ORDER.map((s) => ({ name: s, rows: fields.filter((f) => f.section === s) })).filter((s) => s.rows.length),
    [fields]
  );
  if (!fields.length) return null;
  return (
    <Fold id="checklist" title="What to provide for a new product" aside={`· ${fields.length} fields`} open={open} onToggle={() => setOpen((v) => !v)}>
      <p className="text-[12.5px] text-ink-muted">
        Anything you do not have becomes a question for the owner shown. A field that does not apply can be marked &quot;not applicable&quot; with a reason.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        {sections.map((s) => (
          <div key={s.name}>
            <p className="text-[12.5px] font-semibold text-ink">{s.name}</p>
            <ul className="mt-1 space-y-1">
              {s.rows.map((r) => (
                <li key={r.key} className="flex justify-between gap-2 text-[13px] text-ink-2" title={r.clauses.join(", ")}>
                  <span>
                    {r.label}
                    {r.or && r.or.length > 0 && <span className="text-[12px] text-ink-muted"> (or {r.or.join(", ")})</span>}
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-muted">{r.owner}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Fold>
  );
}

/** Optional: the company's own packaging rules. The reviewer ticks which proposed rules to apply to this brief. */
function RulebookBox({
  proposal,
  accepted,
  loading,
  error,
  onFile,
  onToggle,
  onClear,
}: {
  proposal: RulebookProposal | null;
  accepted: Set<string>;
  loading: boolean;
  error: string | null;
  onFile: (f: File) => void;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(Boolean(proposal));
  useEffect(() => {
    if (proposal) setOpen(true);
  }, [proposal]);
  return (
    <Fold
      id="rulebook"
      title="Company rulebook"
      aside={proposal ? `· ${accepted.size} of ${proposal.rules.length} rules accepted` : "· optional"}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        Upload your own packaging rules (PDF, DOCX or text). BriefForge proposes rules, each quoting the sentence it came from. Only the rules you tick are applied, and only to this brief.
      </p>
      {!proposal && (
        <label className={cn("pressable mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-paper px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink", loading && "opacity-70")}>
          <BookCheck className="h-4 w-4" aria-hidden />
          {loading ? "Reading the rulebook…" : "Choose a rulebook file"}
          <input type="file" accept=".pdf,.docx,.txt,.md" className="sr-only" disabled={loading} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-stop-deep">
          {error}
        </p>
      )}
      {proposal && (
        <div className="mt-3 space-y-2">
          <p className="flex flex-wrap items-center gap-x-3 text-[12.5px] text-ink-muted">
            <span>
              {proposal.filename} · {proposal.rules.length} proposed {proposal.ai_used ? "(keyword match and AI)" : "(keyword match)"}
            </span>
            <button type="button" onClick={onClear} className="font-semibold text-ink-2 underline decoration-ink/30 underline-offset-2 hover:text-ink">
              Remove
            </button>
          </p>
          {proposal.rules.length === 0 && <p className="text-[13px] text-ink-2">No rules that say something must appear were found in this file.</p>}
          <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {proposal.rules.map((r) => (
              <li key={r.id}>
                <label className={cn("flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition-colors", accepted.has(r.id) ? "border-ink/40 bg-paper" : "border-line bg-desk/40")}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#15182B]" checked={accepted.has(r.id)} onChange={() => onToggle(r.id)} />
                  <span className="min-w-0 text-[13px]">
                    <b className="font-semibold text-ink">{r.label}</b>{" "}
                    <span className="text-[12px] text-ink-muted">
                      · {r.severity === "blocking" ? "required" : "recommended"} · {r.owner} · {r.method === "ai" ? "AI" : "keyword"}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] italic text-ink-2">“{r.quote}”</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Fold>
  );
}

const BUSY_LABEL = "Reading files and running checks";

function Processing() {
  const busySince = useBriefStore((s) => s.busySince);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = busySince ? Math.round((now - busySince) / 1000) : 0;
  return (
    <section role="status" aria-live="polite" className="on-ink anim-rise overflow-hidden rounded-lg bg-ink text-white shadow-lift">
      <div className="flex items-center justify-between gap-4 px-6 pt-5">
        <div>
          <h2 className="heading text-[20px]">Sending the files</h2>
          <p className="mt-0.5 text-[13px] text-white/70">Large artwork files can take a minute or two.</p>
        </div>
        <p className="figure text-[40px]" aria-label={`${elapsed} seconds elapsed`}>
          {fmtElapsed(elapsed)}
        </p>
      </div>
      <div className="relative mx-6 mb-5 mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="scan-bar absolute inset-y-0 left-0 w-1/4 rounded-full bg-canary" />
      </div>
    </section>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { start, busy, errorDetail, clearError, load } = useBriefStore();
  const [files, setFiles] = useState<File[]>([]);
  // The duplicate banner belongs to an upload made on this page with these files, never to an older error.
  const [attempted, setAttempted] = useState(false);
  const duplicate =
    attempted && files.length > 0 && (errorDetail as { existing?: string; product_name?: string } | null)?.existing
      ? (errorDetail as { existing: string; product_name: string })
      : null;
  // Changing the files starts a new attempt.
  useEffect(() => setAttempted(false), [files]);
  const [caseType, setCaseType] = useState<CaseType>("update");
  const [market, setMarket] = useState("US");
  const [sourceMarket, setSourceMarket] = useState("");
  const [category, setCategory] = useState("food");
  const [chosen, setChosen] = useState<string[]>([]);
  const [options, setOptions] = useState<StandardsOptions | null>(null);
  const [rules, setRules] = useState<RulesSummary | null>(null);
  const [checklist, setChecklist] = useState<ChecklistField[]>([]);
  const [proposal, setProposal] = useState<RulebookProposal | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rbLoading, setRbLoading] = useState(false);
  const [rbError, setRbError] = useState<string | null>(null);
  const [buildSid, setBuildSid] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showStandards, setShowStandards] = useState(false);
  const [alreadyAdded, setAlreadyAdded] = useState<string[]>([]);
  const analyzing = busy === BUSY_LABEL || submitting || !!buildSid;

  useEffect(() => {
    api.standards().then(setOptions).catch(() => setOptions(null));
  }, []);
  useEffect(() => {
    const call = caseType === "new_product" ? api.checklist(market, category, chosen) : api.applicable(market, category, chosen);
    call
      .then((r) => {
        setRules(r);
        setChecklist("fields" in r ? (r as { fields: ChecklistField[] }).fields : []);
      })
      .catch(() => setRules(null));
  }, [market, category, chosen, caseType]);
  const marketLabel = options?.markets.find((m) => m.code === market)?.label ?? "this market";

  const readRulebook = async (file: File) => {
    setRbLoading(true);
    setRbError(null);
    try {
      const p = await api.companyRulebook(file);
      setProposal(p);
      setAccepted(new Set(p.rules.map((r) => r.id)));
    } catch (e) {
      setRbError(e instanceof Error ? e.message : "Could not read the rulebook.");
    } finally {
      setRbLoading(false);
    }
  };
  const company = proposal ? { filename: proposal.filename, rules: proposal.rules.filter((r) => accepted.has(r.id)) } : undefined;

  // The brief is built in the background; the Autopilot timeline follows it and opens the workbench when done.
  const analyze = async (allowDuplicate = false) => {
    if (!files.length || buildSid) return;
    setAttempted(true);
    clearError();
    setSubmitting(true);
    try {
      const r = await api.uploadStart(files, caseType, market, allowDuplicate, category, chosen, company, sourceMarket);
      setBuildSid(r.session_id);
    } catch (e) {
      const err = e as ApiError;
      useBriefStore.setState({ error: err.message, errorDetail: err.detail, errorStatus: err.status ?? null });
    } finally {
      setSubmitting(false);
    }
  };
  const builtBrief = useCallback(
    async (sid: string) => {
      if ((await load(sid)) === "ok") router.push("/review");
    },
    [load, router]
  );
  const openExisting = async (sid: string) => {
    clearError();
    await load(sid);
    router.push("/review");
  };
  const addFiles = (f: File[]) => {
    // Same name and size as a file already in the list counts as the same file; it is not added twice.
    setAlreadyAdded(f.filter((n) => files.some((p) => p.name === n.name && p.size === n.size)).map((n) => n.name));
    setFiles((prev) => [...prev, ...f.filter((n) => !prev.some((p) => p.name === n.name && p.size === n.size))]);
  };
  const roles = new Set(files.map((f) => f.name.split(".").pop()?.toLowerCase()));

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHead
        title="New brief"
        lead="Add the files for one product: the current packaging PDF, the content sheet, a brief or notes. BriefForge reads them, fills the brief with proof for each value, checks it, and asks only what needs a decision. Each upload becomes its own brief under Projects."
      />
      {duplicate ? (
        <div role="alert" className="anim-rise flex flex-wrap items-center justify-between gap-3 rounded-lg border border-canary-deep/30 bg-canary-soft p-4">
          <p className="text-[14px] text-ink">
            These exact files already have a brief: <b>{duplicate.product_name}</b>. Open it to keep working, or use Add files there for new versions.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                clearError();
                analyze(true);
              }}
            >
              Create a separate brief anyway
            </Button>
            <Button onClick={() => openExisting(duplicate.existing)}>Open the existing brief</Button>
          </div>
        </div>
      ) : (
        <ErrorBanner />
      )}

      {buildSid ? <AutopilotTimeline sessionId={buildSid} onDone={builtBrief} onRetry={() => setBuildSid(null)} /> : analyzing && <Processing />}

      <div className={cn("grid grid-cols-1 gap-8 transition-opacity duration-300 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)] lg:gap-10", analyzing && "pointer-events-none opacity-50")} aria-busy={analyzing}>
        {/* Left: what kind of brief, for which market */}
        <div className="min-w-0 space-y-10">
          <fieldset className="min-w-0">
            <legend className="w-full">
              <StepHead n={1} title="Situation" />
            </legend>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {CASES.map((c) => {
                const on = caseType === c.id;
                const Icon = c.icon;
                return (
                  <label
                    key={c.id}
                    className={cn(
                      "pressable relative flex cursor-pointer flex-col rounded-lg border bg-paper p-4 transition-[border-color,box-shadow,background-color] duration-200",
                      on ? "border-ink shadow-selected" : "border-line shadow-sheet hover:border-line-strong"
                    )}
                  >
                    <input type="radio" name="case" value={c.id} checked={on} onChange={() => setCaseType(c.id)} className="peer sr-only" />
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("grid h-9 w-9 place-items-center rounded-md transition-colors duration-200", on ? "bg-ink text-white" : "bg-desk text-ink-2")}>
                        <Icon className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <span
                        aria-hidden
                        className={cn("grid h-5 w-5 place-items-center rounded-full border-[1.5px] transition-colors duration-200", on ? "border-ink bg-ink text-white" : "border-line-strong")}
                      >
                        {on && <Check className="h-3 w-3" strokeWidth={3.5} />}
                      </span>
                    </span>
                    <span className="mt-3 text-[15px] font-semibold leading-snug text-ink">{c.title}</span>
                    <span className="mt-1 text-[13px] leading-snug text-ink-muted">{c.text}</span>
                    <span className="mt-3 border-t border-dashed border-line-strong pt-2.5 text-[12.5px] leading-snug text-ink-2">{c.effect}</span>
                    <span className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <section aria-labelledby="market-h" className="min-w-0">
            <StepHead n={2} id="market-h" title="Market and rules" />
            <div className={cn("grid grid-cols-1 gap-4", caseType === "new_market" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              {caseType === "new_market" && (
                <div>
                  <label htmlFor="source-market" className="mb-1.5 block text-[13px] font-semibold text-ink">
                    Current pack is for
                  </label>
                  <select id="source-market" value={sourceMarket} onChange={(e) => setSourceMarket(e.target.value)} className={SELECT}>
                    <option value="">Not sure</option>
                    {(options?.markets ?? []).filter((m) => m.code !== market).map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="market" className="mb-1.5 block text-[13px] font-semibold text-ink">
                  Target market
                </label>
                <select id="market" value={market} onChange={(e) => setMarket(e.target.value)} className={SELECT}>
                  {(options?.markets ?? [{ code: "US", label: "United States" }]).map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                  <option value={OTHER}>Another market (general checks only)</option>
                </select>
              </div>
              <div>
                <label htmlFor="category" className="mb-1.5 block text-[13px] font-semibold text-ink">
                  Product category
                </label>
                <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
                  {(options?.categories ?? PRODUCT_CATEGORIES.map((c) => ({ ...c, has_rules: true }))).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                      {c.has_rules ? "" : " (general checks only)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <RulesBox rules={rules} marketLabel={marketLabel} />
              {options && options.standards.length > 0 && (
                <Fold
                  id="standards"
                  title="Choose the rule sets yourself"
                  aside={chosen.length ? `· ${chosen.length} chosen` : "· optional"}
                  open={showStandards}
                  onToggle={() => setShowStandards((v) => !v)}
                >
                  <div className="space-y-1.5">
                    {options.standards.map((s) => (
                      <label key={s.standard} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-[13.5px] text-ink-2 hover:bg-desk/60">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#15182B]"
                          checked={chosen.includes(s.standard)}
                          onChange={(e) => setChosen((p) => (e.target.checked ? [...p, s.standard] : p.filter((x) => x !== s.standard)))}
                        />
                        {s.name} <span className="text-[12px] text-ink-muted">· {s.status}</span>
                      </label>
                    ))}
                    <p className="pt-1 text-[12.5px] text-ink-muted">Leave all unticked to use the rules that match the market and category.</p>
                  </div>
                </Fold>
              )}
              <RulebookBox
                proposal={proposal}
                accepted={accepted}
                loading={rbLoading}
                error={rbError}
                onFile={readRulebook}
                onToggle={(id) =>
                  setAccepted((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onClear={() => {
                  setProposal(null);
                  setAccepted(new Set());
                }}
              />
              {caseType === "new_product" && <ChecklistBox fields={checklist} />}
            </div>
          </section>
        </div>

        {/* Right: the files, and the one action */}
        <aside className="min-w-0 lg:sticky lg:top-[84px] lg:self-start">
          <section aria-labelledby="files-h" className="sheet p-5 md:p-6">
            <StepHead n={3} id="files-h" title="Product files" aside={files.length ? `${files.length} added` : undefined} />
            <FileDropzone files={files} disabled={analyzing} onFilesSelected={addFiles} onFileRemoved={(i) => setFiles((prev) => prev.filter((_, k) => k !== i))} />
            {alreadyAdded.length > 0 && (
              <p className="anim-rise mt-3 flex items-start justify-between gap-2 rounded-md bg-canary-soft px-3 py-2 text-[13px] text-ink">
                <span className="[overflow-wrap:anywhere]">Already in the list, not added twice: {alreadyAdded.join(", ")}.</span>
                <button type="button" onClick={() => setAlreadyAdded([])} className="grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-ink/[0.06]" aria-label="Dismiss">
                  <X className="h-3.5 w-3.5" />
                </button>
              </p>
            )}
            <div className="mt-5 border-t border-line pt-5">
              <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]" aria-label="What the files cover">
                {[
                  ["pdf", "Artwork"],
                  ["xlsx", "Content sheet"],
                  ["docx", "Brief"],
                ].map(([ext, label]) => (
                  <li key={ext} className={cn("inline-flex items-center gap-1.5", roles.has(ext) ? "text-ink" : "text-ink-faint")}>
                    <span className={cn("grid h-4 w-4 place-items-center rounded-full", roles.has(ext) ? "bg-mint-soft text-mint-deep" : "border border-dashed border-line-strong")} aria-hidden>
                      {roles.has(ext) && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                    </span>
                    {label}
                    <span className="sr-only">{roles.has(ext) ? " added" : " not added"}</span>
                  </li>
                ))}
              </ul>
              <Button size="xl" className="w-full" disabled={!files.length || !!busy} onClick={() => analyze()}>
                Build the brief <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="mt-2.5 text-center text-[12.5px] text-ink-muted">
                {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} ready.` : "Add at least one file."} Nothing is invented: a value with no source stays missing.
              </p>
            </div>
          </section>

          <section aria-labelledby="how-h" className="mt-4 rounded-lg border border-line px-5 py-4">
            <h2 id="how-h" className="text-[13.5px] font-semibold text-ink">
              What happens next
            </h2>
            <ol className="mt-3 space-y-2.5">
              {STAGES.map(([name, text], i) => (
                <li key={name} className="grid grid-cols-[22px_1fr] gap-2.5 text-[13px]">
                  <span className="figure grid h-[22px] w-[22px] place-items-center rounded-[5px] border border-line-strong text-[13px] text-ink-2">{i + 1}</span>
                  <span className="leading-snug">
                    <b className="font-semibold text-ink">{name}.</b> <span className="text-ink-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
