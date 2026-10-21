"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutopilotTimeline } from "@/components/upload/AutopilotTimeline";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { ErrorBanner, PageHead, fmtElapsed } from "@/components/shared/Notice";
import { ApiError, api } from "@/lib/api";
import { CaseType, ChecklistField, PRODUCT_CATEGORIES, RulebookProposal, RulesSummary, StandardsOptions } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

const CASES: { id: CaseType; title: string; text: string; effect: string }[] = [
  {
    id: "update",
    title: "Refresh an existing pack",
    text: "Current artwork plus content sheet. Compare them and update.",
    effect: "Where the artwork and the sheet disagree, you are asked which is right.",
  },
  {
    id: "new_market",
    title: "Adapt to a new market",
    text: "An existing pack from another country, made ready for this one.",
    effect: "The new market's sheet wins; differences from the old pack become design changes. Copy only the old pack has is checked with you.",
  },
  {
    id: "new_product",
    title: "New product",
    text: "Spec sheet or notes only; there is no artwork yet.",
    effect: "Any artwork is a reference only: its text is not used and every item is new copy to place.",
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

/** Which label rules will be applied, and how far they can be trusted. */
function RulesBox({ rules, marketLabel }: { rules: RulesSummary | null; marketLabel: string }) {
  if (!rules) return null;
  return (
    <div className="mt-3 rounded border border-line bg-stock p-3 text-[13px]" aria-live="polite">
      {rules.market_rules ? (
        <>
          <p className="font-semibold text-ink">Rules that will be applied for {marketLabel}:</p>
          <ul className="mt-1 space-y-0.5">
            {rules.packs.map((p) => (
              <li key={p.standard} className="text-ink-2">
                {p.name} <span className="text-ink-muted">· {p.clauses} rules ·</span>{" "}
                <span className={p.status === "verified" ? "font-semibold text-rail" : "font-semibold text-talker-deep"}>
                  {p.status === "verified" ? "verified" : "draft: not yet checked against the official text"}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-ink-2">
          <b className="text-ink">No label rules are loaded for {marketLabel} yet.</b> Only the general checks run: math, files
          against each other, claims, and the core brief fields.
        </p>
      )}
    </div>
  );
}

/** For a new product: what the team needs to provide, by section, before any file is read. */
function ChecklistBox({ fields }: { fields: ChecklistField[] }) {
  const sections = useMemo(
    () => SECTION_ORDER.map((s) => ({ name: s, rows: fields.filter((f) => f.section === s) })).filter((s) => s.rows.length),
    [fields]
  );
  if (!fields.length) return null;
  return (
    <details className="mt-3 rounded border border-line p-3 text-[13px]" open>
      <summary className="cursor-pointer select-none font-semibold text-ink">
        What to provide for a new product <span className="figure ml-1 text-[15px]">{fields.length}</span> fields
      </summary>
      <p className="mt-1 text-xs text-ink-muted">
        Anything you do not have becomes a question for the owner shown. A field that does not apply can be marked
        &quot;not applicable&quot; with a reason.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
        {sections.map((s) => (
          <div key={s.name}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{s.name}</p>
            <ul className="mt-0.5 space-y-0.5">
              {s.rows.map((r) => (
                <li key={r.key} className="flex justify-between gap-2 text-ink-2" title={r.clauses.join(", ")}>
                  <span>
                    {r.label}
                    {r.or && r.or.length > 0 && <span className="text-xs text-ink-muted"> (or {r.or.join(", ")})</span>}
                  </span>
                  <span className="text-xs text-ink-muted">{r.owner}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
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
  return (
    <details className="mt-3 rounded border border-line p-3 text-[13px]" open={Boolean(proposal)}>
      <summary className="cursor-pointer select-none font-semibold text-ink">
        Company rulebook (optional){" "}
        {proposal && <span className="font-normal text-ink-muted">· {accepted.size} of {proposal.rules.length} rules accepted</span>}
      </summary>
      <p className="mt-1 text-xs text-ink-muted">
        Upload your own packaging rules (PDF, DOCX or text). BriefForge proposes rules, each quoting the sentence it came from. Only the
        rules you tick are applied, and only to this brief.
      </p>
      {!proposal && (
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded border border-line-strong bg-stock px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink">
          {loading ? "Reading the rulebook…" : "Choose a rulebook file"}
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="sr-only"
            disabled={loading}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-stop-deep">
          {error}
        </p>
      )}
      {proposal && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-ink-muted">
            {proposal.filename} · {proposal.rules.length} proposed {proposal.ai_used ? "(keyword match and AI)" : "(keyword match)"}
            <button onClick={onClear} className="ml-3 underline hover:text-ink">
              Remove
            </button>
          </p>
          {proposal.rules.length === 0 && <p className="text-ink-2">No rules that say something must appear were found in this file.</p>}
          <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {proposal.rules.map((r) => (
              <li key={r.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded border border-line bg-stock p-2">
                  <input type="checkbox" className="mt-0.5" checked={accepted.has(r.id)} onChange={() => onToggle(r.id)} />
                  <span className="min-w-0">
                    <b className="text-ink">{r.label}</b>{" "}
                    <span className="text-xs text-ink-muted">
                      · {r.severity === "blocking" ? "required" : "recommended"} · {r.owner} · {r.method === "ai" ? "AI" : "keyword"}
                    </span>
                    <span className="block text-xs italic text-ink-2">“{r.quote}”</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
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
    <section role="status" aria-live="polite" className="on-rail anim-rise overflow-hidden rounded bg-rail text-white shadow-lift">
      <div className="flex items-center justify-between gap-4 px-5 pt-5">
        <div>
          <h2 className="text-[19px] font-bold">Building the brief</h2>
          <p className="mt-0.5 text-[13px] text-white/75">Large artwork files can take a minute or two.</p>
        </div>
        <p className="figure text-[44px]" aria-label={`${elapsed} seconds elapsed`}>
          {fmtElapsed(elapsed)}
        </p>
      </div>
      <div className="relative mx-5 mt-4 h-1 overflow-hidden rounded-sm bg-white/15">
        <div className="scan-bar absolute inset-y-0 left-0 w-1/4 bg-talker" />
      </div>
      <ol className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-4">
        {STAGES.map(([name, text]) => (
          <li key={name} className="bg-rail px-5 py-4">
            <p className="text-[13px] font-bold">{name}</p>
            <p className="mt-0.5 text-xs leading-snug text-white/70">{text}</p>
          </li>
        ))}
      </ol>
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHead
        title="New brief"
        lead="Add the files for one product: the current packaging PDF, the content sheet, a brief or notes. BriefForge reads them, fills the brief with proof for each value, checks it, and asks only what needs a decision. Each upload becomes its own brief under Projects."
      />
      {duplicate ? (
        <div role="alert" className="ticket anim-rise flex flex-wrap items-center justify-between gap-3 border-talker-deep/40 bg-talker-soft p-4">
          <p className="text-[14px] text-ink">
            These exact files already have a brief: <b>{duplicate.product_name}</b>. Open it to keep working, or use Add files there for new
            versions.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { clearError(); analyze(true); }}>
              Create a separate brief anyway
            </Button>
            <Button onClick={() => openExisting(duplicate.existing)}>Open the existing brief</Button>
          </div>
        </div>
      ) : (
        <ErrorBanner />
      )}

      {buildSid ? (
        <AutopilotTimeline sessionId={buildSid} onDone={builtBrief} onRetry={() => setBuildSid(null)} />
      ) : (
        analyzing && <Processing />
      )}

      <div className={cn("space-y-6", analyzing && "pointer-events-none opacity-50")}>
        <fieldset className="min-w-0">
          <legend className="section-rule mb-3 w-full text-[16px] font-bold text-ink">Situation</legend>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {CASES.map((c) => (
              <label
                key={c.id}
                className={cn(
                  "ticket flex cursor-pointer flex-col gap-1 p-4 pr-3 transition-colors duration-150",
                  caseType === c.id ? "border-ink shadow-[inset_0_0_0_1px_#121514]" : "hover:border-line-strong"
                )}
              >
                <input type="radio" name="case" value={c.id} checked={caseType === c.id} onChange={() => setCaseType(c.id)} className="sr-only" />
                <span className="flex items-start justify-between gap-2">
                  <span className="text-[15px] font-bold leading-snug text-ink">{c.title}</span>
                  <span aria-hidden className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2", caseType === c.id ? "border-rail" : "border-line-strong")}>
                    {caseType === c.id && <span className="h-2 w-2 rounded-full bg-rail" />}
                  </span>
                </span>
                <span className="text-[13px] leading-snug text-ink-muted">{c.text}</span>
                <span className="mt-1 border-t border-line pt-1.5 text-xs leading-snug text-ink-2">{c.effect}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {caseType === "new_market" && (
              <>
                <label htmlFor="source-market" className="text-sm font-semibold text-ink">
                  Current pack is for
                </label>
                <select
                  id="source-market"
                  value={sourceMarket}
                  onChange={(e) => setSourceMarket(e.target.value)}
                  className="h-9 w-full rounded border border-line-strong bg-stock px-2 text-sm font-medium sm:w-auto"
                >
                  <option value="">Not sure</option>
                  {(options?.markets ?? []).filter((m) => m.code !== market).map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span aria-hidden className="text-ink-faint">→</span>
              </>
            )}
            <label htmlFor="market" className="text-sm font-semibold text-ink">
              Target market
            </label>
            <select id="market" value={market} onChange={(e) => setMarket(e.target.value)} className="h-9 w-full rounded border border-line-strong bg-stock px-2 text-sm font-medium sm:w-auto">
              {(options?.markets ?? [{ code: "US", label: "United States" }]).map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
              <option value={OTHER}>Another market (general checks only)</option>
            </select>
            <label htmlFor="category" className="text-sm font-semibold text-ink">
              Product category
            </label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded border border-line-strong bg-stock px-2 text-sm font-medium sm:w-auto">
              {(options?.categories ?? PRODUCT_CATEGORIES.map((c) => ({ ...c, has_rules: true }))).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.has_rules ? "" : " (general checks only)"}
                </option>
              ))}
            </select>
          </div>
          <RulesBox rules={rules} marketLabel={marketLabel} />
          {options && options.standards.length > 0 && (
            <details className="mt-2 text-[13px]">
              <summary className="cursor-pointer select-none text-ink-muted hover:text-ink">Choose the rule sets yourself (optional)</summary>
              <div className="mt-1.5 space-y-1">
                {options.standards.map((s) => (
                  <label key={s.standard} className="flex items-center gap-2 text-ink-2">
                    <input
                      type="checkbox"
                      checked={chosen.includes(s.standard)}
                      onChange={(e) => setChosen((p) => (e.target.checked ? [...p, s.standard] : p.filter((x) => x !== s.standard)))}
                    />
                    {s.name} <span className="text-xs text-ink-muted">· {s.status}</span>
                  </label>
                ))}
                <p className="text-xs text-ink-muted">Leave all unticked to use the rules that match the market and category.</p>
              </div>
            </details>
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
        </fieldset>

        <section aria-labelledby="files-h" className="min-w-0">
          <h2 id="files-h" className="section-rule mb-3 text-[16px] font-bold text-ink">
            Product files
          </h2>
          <FileDropzone
            files={files}
            disabled={analyzing}
            onFilesSelected={(f) => setFiles((prev) => [...prev, ...f.filter((n) => !prev.some((p) => p.name === n.name && p.size === n.size))])}
            onFileRemoved={(i) => setFiles((prev) => prev.filter((_, k) => k !== i))}
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} ready.` : "Add at least one file."}</p>
            <Button size="lg" disabled={!files.length || !!busy} onClick={() => analyze()}>
              Build the brief <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section aria-labelledby="how-h" className="rounded border border-line p-4">
          <h2 id="how-h" className="text-sm font-bold text-ink">
            What happens next
          </h2>
          <ol className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STAGES.map(([name, text], i) => (
              <li key={name} className="grid grid-cols-[22px_1fr] gap-2 text-[13px]">
                <span className="grid h-5 w-5 place-items-center rounded border border-ink text-[11px] font-semibold tabular-nums">{i + 1}</span>
                <span>
                  <b className="text-ink">{name}.</b> <span className="text-ink-muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
