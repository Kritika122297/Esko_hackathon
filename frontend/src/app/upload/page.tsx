"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { ErrorBanner, PageHead, fmtElapsed } from "@/components/shared/Notice";
import { api } from "@/lib/api";
import { CaseType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

const CASES: { id: CaseType; title: string; text: string }[] = [
  { id: "update", title: "Refresh an existing pack", text: "Current artwork plus content sheet. Compare them and update." },
  { id: "new_market", title: "Adapt to a new market", text: "An existing pack from another country, made ready for this one." },
  { id: "new_product", title: "New product", text: "Spec sheet or notes only; there is no artwork yet." },
];

const STAGES = [
  ["Read", "Text with positions, panel grid, hidden layers, sheet cells and notes"],
  ["Fill", "Every brief field from a real source; nothing invented"],
  ["Check", "Math, claims, allergens and US label rules"],
  ["Ask", "Only the decisions that matter, routed by owner"],
];

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
  const duplicate = (errorDetail as { existing?: string; product_name?: string } | null)?.existing
    ? (errorDetail as { existing: string; product_name: string })
    : null;
  const [files, setFiles] = useState<File[]>([]);
  const [caseType, setCaseType] = useState<CaseType>("update");
  const [market, setMarket] = useState("US");
  const analyzing = busy === BUSY_LABEL;

  const analyze = async (allowDuplicate = false) => {
    const ok = await start(() => api.upload(files, caseType, market, allowDuplicate), BUSY_LABEL);
    if (ok) router.push("/analysis");
  };
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

      {analyzing && <Processing />}

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
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label htmlFor="market" className="text-sm font-semibold text-ink">
              Target market
            </label>
            <select id="market" value={market} onChange={(e) => setMarket(e.target.value)} className="h-9 w-full rounded border border-line-strong bg-stock px-2 text-sm font-medium sm:w-auto">
              <option value="US">United States (FDA label rules)</option>
              <option value="EU">European Union (label rules not loaded yet)</option>
            </select>
            {market !== "US" && <span className="text-xs text-ink-muted">Only US label rules are checked today; every other check still runs.</span>}
          </div>
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
