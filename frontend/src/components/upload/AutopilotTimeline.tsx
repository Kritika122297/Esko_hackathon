"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Loader2, RotateCcw } from "lucide-react";
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

function ms(n: number) {
  if (n < 1) return "<1 ms";
  return n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`;
}

function Icon({ status }: { status: TraceEvent["status"] }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-rail" aria-label="Running" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-talker-deep" aria-label="Needs attention" />;
  if (status === "info") return <Info className="h-4 w-4 text-ink-muted" aria-label="Note" />;
  return <CheckCircle2 className="h-4 w-4 text-ok-deep" aria-label="Done" />;
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
        className={cn("grid w-full grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2 rounded px-2 py-1.5 text-left", more && "hover:bg-ground")}
      >
        <Icon status={ev.status} />
        <span className="min-w-0 text-[13px] leading-snug">
          <b className="font-semibold text-ink">{ev.tool}</b> <span className="text-ink-2">{ev.message}</span>
          {ev.citation && <span className="ml-1.5 font-mono text-[10px] text-ink-faint">{ev.citation}</span>}
        </span>
        <span className="flex items-center gap-1 text-[11px] tabular-nums text-ink-faint">
          {ev.status !== "running" && ms(ev.duration_ms)}
          {more && <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />}
        </span>
      </button>
      {open && (
        <div className="mb-1 ml-8 mr-2 rounded bg-ground px-3 py-2 text-xs leading-relaxed text-ink-2">
          {ev.detail && <p className="whitespace-pre-line">{ev.detail.split("; ").join("\n")}</p>}
          {ev.citation && <p className="mt-1 font-mono text-[10px] text-ink-muted">Rule {ev.citation}</p>}
        </div>
      )}
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

  const steps = Array.from(new Set(events.map((e) => e.step)));
  const warnings = events.filter((e) => e.status === "warning").length;
  const took = events.length ? Math.max(0, (Date.parse(events[events.length - 1].timestamp) - Date.parse(events[0].timestamp)) / 1000) : 0;
  const running = status === "running";

  return (
    <section role="status" aria-live="polite" aria-labelledby="autopilot-h" className="ticket anim-rise overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-rail px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3" aria-hidden>
            {running && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-talker opacity-75" />}
            <span className={cn("relative inline-flex h-3 w-3 rounded-full", running ? "bg-talker" : status === "done" ? "bg-[#9AD5B8]" : "bg-stop")} />
          </span>
          <div>
            <h2 id="autopilot-h" className="text-[18px] font-bold">Brief Autopilot</h2>
            <p className="text-[12px] text-white/75">
              {running ? "Live: every line is a step the pipeline has just run, with its real counts." : status === "done" ? "Finished." : "Stopped."}
            </p>
          </div>
        </div>
        <p className="figure text-[28px] tabular-nums" aria-label="Elapsed">
          {running ? `${Math.round((Date.now() - started.current) / 1000)} s` : `${took.toFixed(1)} s`}
        </p>
      </header>

      <div className="max-h-[460px] overflow-y-auto px-3 py-3">
        {events.length === 0 && running && (
          <p className="flex items-center gap-2 px-2 py-2 text-[13px] text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Starting…</p>
        )}
        {steps.map((step) => (
          <div key={step} className="mb-2">
            <p className="meta px-2 pb-0.5 pt-1 text-ink-faint">{STEP_TEXT[step] ?? step}</p>
            <ol>
              {events.filter((e) => e.step === step).map((e) => (
                <Row key={e.id} ev={e} />
              ))}
            </ol>
          </div>
        ))}
      </div>

      {status === "done" && (
        <p className="border-t border-line bg-ok-soft px-5 py-3 text-[13px] text-ink">
          <b className="font-semibold">Done in {took.toFixed(1)} s:</b> {steps.length} stages, {events.length} steps,{" "}
          {warnings} need attention. Opening the workbench…
        </p>
      )}
      {status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-stop-soft px-5 py-3 text-[13px] text-ink">
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
