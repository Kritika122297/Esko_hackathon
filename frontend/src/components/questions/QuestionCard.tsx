"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerBody, api } from "@/lib/api";
import { AnsweredQuestion, Question, QuestionOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";
import { Flag, OwnerTag } from "@/components/shared/badges";

const UNKNOWN = "__unknown";
const NA = "__na";

function Choice({ name, on, onPick, children }: { name: string; on: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded border px-3 py-2.5 text-[13px] transition-colors duration-150",
        on ? "border-ink bg-ground shadow-[inset_0_0_0_1px_#121514]" : "border-line hover:border-line-strong"
      )}
    >
      <input type="radio" name={name} checked={on} onChange={onPick} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F3D2E]" />
      {children}
    </label>
  );
}

type Initial = { choice: string | null; custom?: string; reason?: string };

/** The answer choices for one question: computed options, a typed value, "I don't know" and "Not applicable". */
function AnswerForm({
  qid,
  options,
  customField,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  qid: string;
  options: QuestionOption[];
  customField?: string | null;
  initial: Initial;
  submitLabel: string;
  onSubmit: (body: AnswerBody) => void;
  onCancel?: () => void;
}) {
  const { busy, view } = useBriefStore();
  const [choice, setChoice] = useState<string | null>(initial.choice);
  const [custom, setCustom] = useState(initial.custom ?? "");
  const [reason, setReason] = useState(initial.reason ?? "");
  const finalized = view?.state.status === "finalized";
  const id = qid.replace(/[^a-z0-9]/gi, "-");
  const name = `${qid}-${submitLabel}`;
  const pick = (c: string) => {
    setChoice(c);
    setCustom("");
  };
  // Options can be recalculated under the same question after a re-check. A choice that no longer exists
  // falls back to the suggested option (or none), so Apply never sends an unknown option.
  useEffect(() => {
    setChoice((c) => {
      if (c === null || c === UNKNOWN || c === NA || options.some((o) => o.id === c)) return c;
      return options.find((o) => o.recommended)?.id ?? null;
    });
  }, [options]);
  const validChoice = choice === UNKNOWN || choice === NA || options.some((o) => o.id === choice);

  const body = (): AnswerBody => {
    if (custom.trim()) return { custom_value: custom.trim() };
    if (choice === UNKNOWN) return { kind: "unknown" };
    if (choice === NA) return { kind: "not_applicable", note: reason.trim() };
    return { option_id: choice ?? undefined };
  };
  const canApply = !!custom.trim() || (choice === NA ? !!reason.trim() : !!choice && validChoice);

  return (
    <>
      <fieldset className="mt-3 space-y-1.5">
        <legend className="sr-only">Answer options</legend>
        {options.map((o) => (
          <Choice key={o.id} name={name} on={choice === o.id && !custom} onPick={() => pick(o.id)}>
            <span className="flex-1 break-words leading-snug text-ink">{o.label}</span>
            {o.recommended && (
              <Flag tone="ok" side="right" className="-mr-3 shrink-0">
                Suggested
              </Flag>
            )}
          </Choice>
        ))}
        {customField && (
          <div>
            <label htmlFor={`${id}-${submitLabel}-custom`} className="sr-only">
              Or type the correct value
            </label>
            <input
              id={`${id}-${submitLabel}-custom`}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Or type the correct value…"
              className="h-10 w-full rounded border border-line-strong bg-stock px-3 text-[13px] focus:border-ink"
            />
          </div>
        )}
        <p className="meta pt-2 text-ink-faint">Cannot answer?</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <Choice name={name} on={choice === UNKNOWN && !custom} onPick={() => pick(UNKNOWN)}>
            <span className="flex-1 leading-snug text-ink-2">
              I don&apos;t know
              <span className="block text-xs text-ink-muted">Passed to the agency as an open question</span>
            </span>
          </Choice>
          <Choice name={name} on={choice === NA && !custom} onPick={() => pick(NA)}>
            <span className="flex-1 leading-snug text-ink-2">
              Not applicable
              <span className="block text-xs text-ink-muted">Does not apply to this product</span>
            </span>
          </Choice>
        </div>
        {choice === NA && !custom && (
          <div>
            <label htmlFor={`${id}-${submitLabel}-reason`} className="sr-only">
              Why does this not apply?
            </label>
            <input
              id={`${id}-${submitLabel}-reason`}
              value={reason}
              autoFocus
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why does this not apply? (required, kept in the log)"
              className="h-10 w-full rounded border border-line-strong bg-stock px-3 text-[13px] focus:border-ink"
            />
          </div>
        )}
      </fieldset>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">Applying re-runs every check and is logged.</p>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button disabled={finalized || !!busy || !canApply} onClick={() => onSubmit(body())}>
            <Check className="h-4 w-4" /> {submitLabel}
          </Button>
        </div>
      </div>
    </>
  );
}

function Why({ id, why }: { id: string; why: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-why`}
        className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-rail underline decoration-1 underline-offset-[3px] hover:decoration-2"
      >
        Why am I asked this? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div id={`${id}-why`} className="disclosure" data-open={open}>
        <div>
          <p className="mt-2 rounded bg-ground p-3 text-[13px] leading-relaxed text-ink-2">{why}</p>
        </div>
      </div>
    </>
  );
}

export function QuestionCard({ q, index }: { q: Question; index: number }) {
  const { run } = useBriefStore();
  const id = q.id.replace(/[^a-z0-9]/gi, "-");
  const submit = (body: AnswerBody) =>
    run("Applying answer and re-checking", (sid) => api.answer(sid, q.id, body), "Answer applied · checks re-run");

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
        <Why id={id} why={q.why} />
        <AnswerForm
          qid={q.id}
          options={q.options}
          customField={q.custom_field}
          initial={{ choice: q.options.find((o) => o.recommended)?.id ?? null }}
          submitLabel="Apply answer"
          onSubmit={submit}
        />
      </div>
    </article>
  );
}

const KIND_LABEL: Record<AnsweredQuestion["kind"], string> = {
  option: "Answered",
  custom: "Answered · typed value",
  agency: "Passed to agency",
  unknown: "Not known · passed to agency",
  not_applicable: "Not applicable",
};

function initialFor(a: AnsweredQuestion): Initial {
  if (a.kind === "custom") return { choice: null, custom: a.answer };
  if (a.kind === "unknown") return { choice: UNKNOWN };
  if (a.kind === "not_applicable") return { choice: NA, reason: a.note ?? "" };
  return { choice: a.option_id ?? a.options.find((o) => o.label === a.answer)?.id ?? null };
}

export function AnsweredCard({ a }: { a: AnsweredQuestion }) {
  const { run, busy, view } = useBriefStore();
  const [editing, setEditing] = useState(false);
  const finalized = view?.state.status === "finalized";
  const passed = a.kind === "agency" || a.kind === "unknown";
  const id = `a-${a.id.replace(/[^a-z0-9]/gi, "-")}`;
  const submit = async (body: AnswerBody) => {
    const ok = await run("Changing answer and re-checking", (sid) => api.changeAnswer(sid, a.id, body), "Answer changed · checks re-run");
    if (ok) setEditing(false);
  };

  return (
    <article aria-labelledby={`${id}-q`} className={cn("ticket", editing && "border-ink")}>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 pr-4 pt-3">
        <Flag tone={passed ? "review" : "ok"} side="right">
          <Check className="mr-1 inline h-3 w-3 align-[-1px]" strokeWidth={3} aria-hidden />
          {passed ? "Passed to agency" : a.kind === "not_applicable" ? "Confirmed · not applicable" : "Confirmed"}
        </Flag>
        <span />
        <OwnerTag owner={a.owner} />
      </div>
      <div className="px-4 pb-3 pt-2.5">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 id={`${id}-q`} className="text-[14px] font-semibold leading-snug text-ink-2">
              {a.question}
            </h3>
            {!editing && (
              <Button variant="outline" size="sm" className="shrink-0" disabled={finalized || !!busy} onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Change answer
              </Button>
            )}
          </div>
          <p className="mt-1 break-words text-[13px] leading-snug text-ink">
            <span className="text-ink-muted">{editing ? "Current answer: " : "Answer: "}</span>
            {a.answer}
          </p>
          <p className="meta mt-1.5 text-ink-faint">
            {KIND_LABEL[a.kind]} · {a.by} · {new Date(a.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            {a.ai_worded && " · AI-worded"}
          </p>
          {editing && (
            <>
              <Why id={id} why={a.why} />
              <AnswerForm
                qid={a.id}
                options={a.options}
                customField={a.custom_field}
                initial={initialFor(a)}
                submitLabel="Save new answer"
                onSubmit={submit}
                onCancel={() => setEditing(false)}
              />
              <p className="mt-2 text-xs text-ink-muted">The earlier answer is undone first. Fields edited by hand since then are left as they are.</p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
