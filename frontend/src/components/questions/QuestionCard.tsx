"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Question } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";
import { Flag, OwnerTag } from "@/components/shared/badges";

export function QuestionCard({ q, index }: { q: Question; index: number }) {
  const { run, busy, view } = useBriefStore();
  const recommended = q.options.find((o) => o.recommended);
  const [choice, setChoice] = useState<string | null>(recommended?.id ?? null);
  const [custom, setCustom] = useState("");
  const [showWhy, setShowWhy] = useState(false);
  const finalized = view?.state.status === "finalized";
  const id = q.id.replace(/[^a-z0-9]/gi, "-");

  const submit = () =>
    run(
      "Applying answer and re-checking",
      (sid) => api.answer(sid, q.id, custom.trim() ? { custom_value: custom.trim() } : { option_id: choice ?? undefined }),
      "Answer applied · checks re-run"
    );

  return (
    <article aria-labelledby={`${id}-q`} className="ticket anim-rise" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 pr-4 pt-3">
        <Flag tone={q.priority === "must_answer" ? "stop" : "outline"} side="right">
          {q.priority === "must_answer" ? "Must answer" : "Should answer"}
        </Flag>
        <span />
        <OwnerTag owner={q.owner} />
      </div>

      <div className="px-4 pb-4 pt-2.5">
        <h3 id={`${id}-q`} className="text-[17px] font-bold leading-snug text-ink">
          {q.question}
        </h3>
        {q.ai_worded && (
          <p className="mt-1 text-[11px] uppercase tracking-wider text-ink-faint" title={q.original_question ?? undefined}>
            AI-worded · answers are computed by code
          </p>
        )}
        <button
          onClick={() => setShowWhy((v) => !v)}
          aria-expanded={showWhy}
          aria-controls={`${id}-why`}
          className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-rail underline decoration-1 underline-offset-[3px] hover:decoration-2"
        >
          Why am I asked this? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showWhy && "rotate-180")} />
        </button>
        <div id={`${id}-why`} className="disclosure" data-open={showWhy}>
          <div>
            <p className="mt-2 rounded bg-ground p-3 text-[13px] leading-relaxed text-ink-2">{q.why}</p>
          </div>
        </div>

        <fieldset className="mt-3 space-y-1.5">
          <legend className="sr-only">Answer options</legend>
          {q.options.map((o) => {
            const on = choice === o.id && !custom;
            return (
              <label
                key={o.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded border px-3 py-2.5 text-[13px] transition-colors duration-150",
                  on ? "border-ink bg-ground shadow-[inset_0_0_0_1px_#121514]" : "border-line hover:border-line-strong"
                )}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={on}
                  onChange={() => {
                    setChoice(o.id);
                    setCustom("");
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F3D2E]"
                />
                <span className="flex-1 break-words leading-snug text-ink">{o.label}</span>
                {o.recommended && (
                  <Flag tone="ok" side="right" className="-mr-3 shrink-0">
                    Suggested
                  </Flag>
                )}
              </label>
            );
          })}
          {q.custom_field && (
            <div>
              <label htmlFor={`${id}-custom`} className="sr-only">
                Or type the correct value
              </label>
              <input
                id={`${id}-custom`}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Or type the correct value…"
                className="h-10 w-full rounded border border-line-strong bg-stock px-3 text-[13px] focus:border-ink"
              />
            </div>
          )}
        </fieldset>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">Applying re-runs every check and is logged.</p>
          <Button disabled={finalized || !!busy || (!choice && !custom.trim())} onClick={submit}>
            <Check className="h-4 w-4" /> Apply answer
          </Button>
        </div>
      </div>
    </article>
  );
}
