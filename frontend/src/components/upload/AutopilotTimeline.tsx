"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Info, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { TraceEvent, TraceView } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEP_TEXT: Record<string, string> = {
  upload: "Upload",
  read: "Read the files",
  extract: "Fill the brief",
  reconcile: "Compare the sources",
  checks: "Check the label rules",
  ai: "AI review",
  route: "Route the questions",
  save: "Save the brief",
};
const STEP_ORDER = Object.keys(STEP_TEXT);

function ms(n: number) {
  if (n < 1) return "<1 ms";
  return n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`;
}

function Icon({ status }: { status: TraceEvent["status"] }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-ink" aria-label="Running" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-gold-deep" aria-label="Needs attention" />;
  if (status === "info") return <Info className="h-4 w-4 text-ink-muted" aria-label="Note" />;
  return (
    <span className="grid h-4 w-4 place-items-center rounded-full bg-mint-soft text-mint-deep" aria-label="Done">
      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
    </span>
  );
}

function Row({ ev }: { ev: TraceEvent }) {
  const [open, setOpen] = useState(false);
  const more = !!(ev.detail || ev.citation);
  return (
    <li className="anim-rise">
      <button
        type="button"
        onClick={() => more && setOpen((v) => !v)}
        aria-expanded={more ? open : undefined}
        disabled={!more}
        className={cn("grid w-full grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-md px-2 py-1.5 text-left disabled:cursor-default", more && "hover:bg-desk/70")}
      >
        <span className="pt-0.5">
          <Icon status={ev.status} />
        </span>
        <span className="min-w-0 text-[13.5px] leading-snug">
          <b className="font-semibold text-ink">{ev.tool}</b> <span className="text-ink-2">{ev.message}</span>
          {ev.citation && <span className="ml-1.5 text-[11px] tabular-nums text-ink-faint">{ev.citation}</span>}
        </span>
        <span className="flex items-center gap-1 pt-0.5 text-[12px] tabular-nums text-ink-faint">
          {ev.status !== "running" && ms(ev.duration_ms)}
          {more && <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 ease-out", open && "rotate-180")} aria-hidden />}
        </span>
      </button>
      <div className="disclosure" data-open={open} aria-hidden={!open}>
        <div>
          <div className="mb-1 ml-9 mr-2 rounded-md bg-desk px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
            {ev.detail && <p className="whitespace-pre-line">{ev.detail.split("; ").join("\n")}</p>}
            {ev.citation && <p className="mt-1 text-[11px] tabular-nums text-ink-muted">Rule {ev.citation}</p>}
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Brief Autopilot: the pipeline's own trace, shown as it runs. Events arrive by server-sent events; if the stream
 * fails, the trace is polled instead. A finished build is replayed from the stored trace.
 */
export function AutopilotTimeline({
  sessionId,
  onDone,
  onRetry,
}: {
  sessionId: string;
  onDone: (sid: string) => void;
  onRetry: () => void;
}) {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [status, setStatus] = useState<TraceView["status"]>("running");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(Date.now());
  const finished = useRef(false);

  useEffect(() => {
    let closed = false;
    let poll: number | undefined;
    const merge = (incoming: TraceEvent[]) =>
      setEvents((prev) => {
        const next = [...prev];
        for (const ev of incoming) {
          const i = next.findIndex((x) => x.id === ev.id);
          if (i >= 0) next[i] = ev; // a 'running' step replaced by its result
          else next.push(ev);
        }
        return next;
      });
    const finish = (st: TraceView["status"], err?: string | null) => {
      if (finished.current) return;
      finished.current = true;
      setStatus(st);
      setError(err ?? null);
    };
    const startPolling = () => {
      const tick = async () => {
        try {
          const t = await api.trace(sessionId);
          if (closed) return;
          merge(t.events);
          if (t.status !== "running") return finish(t.status, t.error);
        } catch (e) {
          if (closed) return;
          return finish("error", e instanceof Error ? e.message : "The trace could not be loaded.");
        }
        poll = window.setTimeout(tick, 700);
      };
      tick();
    };
    let es: EventSource | null = null;
    try {
      es = new EventSource(api.traceStreamUrl(sessionId));
      es.addEventListener("trace", (e) => merge([JSON.parse((e as MessageEvent).data) as TraceEvent]));
      es.addEventListener("done", (e) => {
        const d = JSON.parse((e as MessageEvent).data) as { status: TraceView["status"]; error?: string | null };
        es?.close();
        finish(d.status === "error" ? "error" : "done", d.error);
      });
      es.onerror = () => {
        es?.close();
        if (!closed && !finished.current) startPolling(); // fall back: ask for the trace instead
      };
    } catch {
      startPolling();
    }
    return () => {
      closed = true;
      es?.close();
      window.clearTimeout(poll);
    };
  }, [sessionId]);

  // The elapsed clock ticks while the build runs.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "running") return;
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [status]);

  // Open the workbench a moment after a successful build, so the summary can be read.
  useEffect(() => {
    if (status !== "done") return;
    const t = window.setTimeout(() => onDone(sessionId), 1600);
    return () => window.clearTimeout(t);
  }, [status, sessionId, onDone]);

  // Keep the newest line in view while the trace grows.
  const list = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = list.current;
    if (el && status === "running") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [events.length, status]);

  const steps = Array.from(new Set(events.map((e) => e.step)));
  const warnings = events.filter((e) => e.status === "warning").length;
  const took = events.length ? Math.max(0, (Date.parse(events[events.length - 1].timestamp) - Date.parse(events[0].timestamp)) / 1000) : 0;
  const running = status === "running";
  // Progress by pipeline stage reached, from the real trace; the bar fills when the build reports done.
  const reached = steps.reduce((m, s) => Math.max(m, STEP_ORDER.indexOf(s) + 1), 0);
  const progress = status === "done" ? 1 : Math.min(0.96, reached / STEP_ORDER.length);
  const currentStep = [...events].reverse().find((e) => e.status === "running")?.step ?? steps[steps.length - 1];

  return (
    <section role="status" aria-live="polite" aria-labelledby="autopilot-h" className="sheet anim-rise overflow-hidden">
      <header className="on-ink bg-ink px-5 pb-5 pt-4 text-white md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3" aria-hidden>
              {running && <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-canary" />}
              <span className={cn("relative inline-flex h-3 w-3 rounded-full", running ? "bg-canary" : status === "done" ? "bg-mint" : "bg-stop")} />
            </span>
            <div>
              <h2 id="autopilot-h" className="heading text-[20px]">
                {running ? "Building the brief" : status === "done" ? "Brief built" : "The build stopped"}
              </h2>
              <p className="text-[13px] text-white/70">
                {running
                  ? `${STEP_TEXT[currentStep ?? ""] ?? "Starting"}… every line below is a step the pipeline has just run, with its real counts.`
                  : status === "done"
                    ? "Opening the workbench."
                    : "See the step marked below."}
              </p>
            </div>
          </div>
          <p className="figure text-[34px]" aria-label="Elapsed">
            {running ? `${Math.round((Date.now() - started.current) / 1000)}s` : `${took.toFixed(1)}s`}
          </p>
        </div>
        <div className="mt-4">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-label="Build progress by stage"
            aria-valuemin={0}
            aria-valuemax={STEP_ORDER.length}
            aria-valuenow={status === "done" ? STEP_ORDER.length : reached}
          >
            <div
              className={cn("h-full origin-left rounded-full transition-transform duration-700 ease-out", status === "error" ? "bg-stop" : status === "done" ? "bg-mint" : "bg-canary")}
              style={{ transform: `scaleX(${Math.max(progress, 0.03)})` }}
            />
          </div>
          <ol className="mt-2.5 hidden grid-cols-8 gap-2 text-[11.5px] md:grid" aria-hidden>
            {STEP_ORDER.map((s, i) => (
              <li key={s} className={cn("truncate transition-colors duration-300", i < reached || status === "done" ? "text-white" : "text-white/40")}>
                {STEP_TEXT[s]}
              </li>
            ))}
          </ol>
        </div>
      </header>

      <div ref={list} className="max-h-[420px] overflow-y-auto px-3 py-3 md:px-4">
        {events.length === 0 && running && (
          <p className="flex items-center gap-2 px-2 py-2 text-[13.5px] text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Sending the files…
          </p>
        )}
        {steps.map((step) => (
          <div key={step} className="mb-2">
            <p className="px-2 pb-1 pt-1.5 text-[12px] font-semibold text-ink-faint">{STEP_TEXT[step] ?? step}</p>
            <ol>
              {events.filter((e) => e.step === step).map((e) => (
                <Row key={e.id} ev={e} />
              ))}
            </ol>
          </div>
        ))}
      </div>

      {status === "done" && (
        <p className="border-t border-line bg-mint-soft px-5 py-3 text-[13.5px] text-ink md:px-6">
          <b className="font-semibold">Done in {took.toFixed(1)} s:</b> {steps.length} stages, {events.length} steps, {warnings} need attention. Opening the workbench…
        </p>
      )}
      {status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-stop-soft px-5 py-3 text-[13.5px] text-ink md:px-6">
          <p>
            <b className="font-semibold">The brief could not be built.</b> {error ?? "See the step marked above."}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" /> Back to the upload
          </Button>
        </div>
      )}
    </section>
  );
}
