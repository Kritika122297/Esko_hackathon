"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, Printer, ScanSearch, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/shared/badges";
import { api } from "@/lib/api";
import { SimulatorReport } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<SimulatorReport["status"], { text: string; tone: "ok" | "review" | "stop" }> = {
  READY_FOR_STUDIO: { text: "Ready for studio", tone: "ok" },
  CHANGES_REQUIRED: { text: "Changes required", tone: "review" },
  BLOCKED: { text: "Blocked", tone: "stop" },
};

function reportText(r: SimulatorReport): string {
  const lines = [
    `Agency Simulator report: ${r.product}`,
    `Market ${r.market} · ${r.category} · Score ${r.score}/100 · ${STATUS[r.status].text}`,
    "",
    r.designer_summary,
    "",
    "Checks (scored by code):",
    ...r.checks.map((c) => `- [${c.severity === "info" ? "n/a" : c.passed ? "pass" : "FAIL"}] ${c.name}: ${c.detail}` +
      (c.suggestion ? ` Fix: ${c.suggestion}` : "") + (c.clause_id ? ` (${c.clause_id})` : "")),
  ];
  if (r.ambiguities.length) {
    lines.push("", "What the studio would still ask (AI prepress operator):", ...r.ambiguities.map((a) => `- ${a.topic}: ${a.question}`));
  }
  if (r.llm_unavailable) lines.push("", "The AI prepress pass was unavailable; the checks above are complete.");
  return lines.join("\n");
}

/** "Run Agency Simulator": code checks score the brief; the AI lists what a prepress operator would still ask. */
export function AgencySimulatorButton({ sessionId }: { sessionId: string }) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<SimulatorReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const run = async () => {
    setOpen(true);
    setRunning(true);
    setError(null);
    try {
      setReport(await api.runAgencySimulator(sessionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The simulator could not run.");
    } finally {
      setRunning(false);
    }
  };

  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([reportText(report)], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.product.replace(/[^A-Za-z0-9]+/g, "_")}_Agency_Simulator.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const print = () => {
    if (!report) return;
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    const pre = w.document.createElement("pre");
    pre.style.cssText = "font:13px/1.5 system-ui,sans-serif;white-space:pre-wrap;margin:32px";
    pre.textContent = reportText(report);
    w.document.title = `Agency Simulator: ${report.product}`;
    w.document.body.appendChild(pre);
    w.print();
  };

  const failed = report?.checks.filter((c) => !c.passed) ?? [];
  const passed = report?.checks.filter((c) => c.passed && c.severity !== "info") ?? [];
  const na = report?.checks.filter((c) => c.severity === "info") ?? [];
  const ready = report && report.score === 100 && report.ambiguities.length === 0 && report.status === "READY_FOR_STUDIO";

  return (
    <>
      <Button onClick={run} disabled={running} aria-haspopup="dialog">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />} Run Agency Simulator
      </Button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="sim-h"
        className="max-h-[calc(100vh-32px)] w-[min(760px,calc(100vw-32px))] overflow-y-auto rounded border border-line bg-stock p-0 text-ink shadow-lift backdrop:bg-ink/40"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="sim-h" className="text-[18px] font-bold">Agency Simulator</h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Would a packaging studio accept this brief as it is? The score comes from code checks; the AI only adds what it still
              cannot tell.
            </p>
          </div>
          <button onClick={() => setOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded hover:bg-ink/5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4" aria-live="polite">
          {running && <p className="flex items-center gap-2 text-[13px] text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Checking the brief as a studio would…</p>}
          {error && <p role="alert" className="rounded border border-stop/40 bg-stop-soft px-3 py-2 text-[13px]">{error}</p>}
          {report && !running && (
            <>
              <div className={cn("flex flex-wrap items-center gap-5 rounded border p-4", ready ? "border-ok bg-ok-soft" : "border-line bg-ground")}>
                <p className="figure text-[48px] leading-none text-ink">
                  {report.score}
                  <span className="text-[18px] text-ink-muted">/100</span>
                </p>
                <div className="space-y-1">
                  <Flag tone={STATUS[report.status].tone} side="right" className="-ml-3">{STATUS[report.status].text}</Flag>
                  <p className="text-[13px] text-ink-2">{ready ? "Every check passed and the studio has no open questions. Hand it over." : report.designer_summary}</p>
                </div>
              </div>

              {failed.length > 0 && (
                <section aria-labelledby="sim-fail-h">
                  <h3 id="sim-fail-h" className="meta mb-2 text-ink-muted">To fix · {failed.length}</h3>
                  <ul className="space-y-2">
                    {failed.map((c) => (
                      <li key={c.id} className="flex gap-3 rounded border border-line p-3">
                        <XCircle className={cn("mt-0.5 h-4 w-4 shrink-0", c.severity === "blocking" ? "text-stop" : "text-talker-deep")} aria-hidden />
                        <div className="min-w-0 text-[13px]">
                          <p className="font-semibold text-ink">
                            {c.name} <span className="meta ml-1 text-ink-faint">{c.severity === "blocking" ? "Blocking" : "Warning"}</span>
                          </p>
                          <p className="text-ink-2">{c.detail}</p>
                          {c.suggestion && <p className="mt-0.5 text-ink"><b className="font-semibold">Fix:</b> {c.suggestion}</p>}
                          {c.clause_id && <p className="mt-0.5 font-mono text-[10px] text-ink-faint">{c.clause_id}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {report.ambiguities.length > 0 && (
                <section aria-labelledby="sim-amb-h">
                  <h3 id="sim-amb-h" className="meta mb-2 text-ink-muted">The studio would still ask · AI prepress operator</h3>
                  <ul className="space-y-1.5 text-[13px]">
                    {report.ambiguities.map((a) => (
                      <li key={a.question} className="rounded bg-ground px-3 py-2">
                        <b className="font-semibold text-ink">{a.topic}:</b> <span className="text-ink-2">{a.question}</span>
                        {a.panel && <span className="meta ml-2 text-ink-faint">{a.panel}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {report.llm_unavailable && (
                <p className="text-xs text-ink-muted">The AI prepress pass was unavailable just now. The checks are complete; only the extra questions are missing.</p>
              )}

              {passed.length > 0 && (
                <section aria-labelledby="sim-pass-h">
                  <h3 id="sim-pass-h" className="meta mb-2 text-ink-muted">Passed · {passed.length}</h3>
                  <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {passed.map((c) => (
                      <li key={c.id} className="flex gap-2 text-[13px]" title={c.detail}>
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok-deep" aria-hidden />
                        <span className="text-ink-2">{c.name}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {na.length > 0 && (
                <p className="text-xs text-ink-muted">Not applicable here: {na.map((c) => c.name.toLowerCase()).join("; ")}.</p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          <Button variant="outline" onClick={print} disabled={!report || running}><Printer className="h-4 w-4" /> Print</Button>
          <Button variant="outline" onClick={download} disabled={!report || running}><Download className="h-4 w-4" /> Download report</Button>
          <Button onClick={run} disabled={running}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />} Run again</Button>
        </div>
      </dialog>
    </>
  );
}
