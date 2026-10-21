"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, HelpCircle, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerBody, api } from "@/lib/api";
import { AnsweredQuestion, Question, QuestionOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";
import { Stamp, OwnerTag } from "@/components/shared/badges";

const UNKNOWN = "__unknown";
const NA = "__na";

function Choice({ name, on, onPick, children }: { name: string; on: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-[13.5px] transition-[border-color,background-color,box-shadow] duration-150",
        on ? "border-ink bg-paper shadow-selected" : "border-line bg-paper hover:border-line-strong hover:bg-desk/40"
      )}
    >
      <input type="radio" name={name} checked={on} onChange={onPick} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
          on ? "border-ink bg-ink" : "border-line-strong bg-paper group-hover:border-ink-soft"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full bg-paper transition-transform duration-150 ease-out", on ? "scale-100" : "scale-0")} />
      </span>
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
      <fieldset className="mt-4 space-y-2">
        <legend className="sr-only">Answer options</legend>
        {options.map((o) => (
          <Choice key={o.id} name={name} on={choice === o.id && !custom} onPick={() => pick(o.id)}>
            <span className="flex-1 break-words leading-snug text-ink">{o.label}</span>
            {o.recommended && (
              <Stamp tone="ok" className="shrink-0">
                Suggested
              </Stamp>
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
              className={cn(
                "h-11 w-full rounded-lg border bg-paper px-3.5 text-[13.5px] transition-[border-color,box-shadow] focus:border-ink",
                custom.trim() ? "border-ink shadow-selected" : "border-line-strong"
              )}
            />
          </div>
        )}
        <p className="flex items-center gap-1.5 pt-2 text-[12.5px] font-semibold text-ink-muted">
          <HelpCircle className="h-3.5 w-3.5" aria-hidden /> Cannot answer?
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice name={name} on={choice === UNKNOWN && !custom} onPick={() => pick(UNKNOWN)}>
            <span className="flex-1 leading-snug text-ink-2">
              I don&apos;t know
              <span className="block text-[12.5px] text-ink-muted">Passed to the agency as an open question</span>
            </span>
          </Choice>
          <Choice name={name} on={choice === NA && !custom} onPick={() => pick(NA)}>
            <span className="flex-1 leading-snug text-ink-2">
              Not applicable
              <span className="block text-[12.5px] text-ink-muted">Does not apply to this product</span>
            </span>
          </Choice>
        </div>
        {choice === NA && !custom && (
          <div className="anim-rise">
            <label htmlFor={`${id}-${submitLabel}-reason`} className="sr-only">
              Why does this not apply?
            </label>
            <input
              id={`${id}-${submitLabel}-reason`}
              value={reason}
              autoFocus
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why does this not apply? (required, kept in the log)"
              className="h-11 w-full rounded-lg border border-line-strong bg-paper px-3.5 text-[13.5px] focus:border-ink"
            />
          </div>
        )}
      </fieldset>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[12.5px] text-ink-muted">Applying re-runs every check and is logged.</p>
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
        className="mt-2 inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-ink-2 underline decoration-ink/30 decoration-1 underline-offset-[3px] hover:text-ink hover:decoration-ink"
      >
        Why am I asked this? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 ease-out", open && "rotate-180")} />
      </button>
      <div id={`${id}-why`} className="disclosure" data-open={open} aria-hidden={!open}>
        <div>
          <p className="mt-2 rounded-lg bg-desk/70 p-3.5 text-[13.5px] leading-relaxed text-ink-2">{why}</p>
        </div>
      </div>
    </>
  );
}

export function QuestionCard({ q, index }: { q: Question; index: number }) {
  const { run } = useBriefStore();
  const id = q.id.replace(/[^a-z0-9]/gi, "-");
  const must = q.priority === "must_answer";
  const submit = (body: AnswerBody) => run("Applying answer and re-checking", (sid) => api.answer(sid, q.id, body), "Answer applied · checks re-run");

  return (
    <article aria-labelledby={`${id}-q`} className="sheet p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="figure text-[15px] text-ink-faint" aria-hidden>
            {String(index + 1).padStart(2, "0")}
          </span>
          <Stamp tone={must ? "stop" : "ink"}>{must ? "Must answer" : "Should answer"}</Stamp>
        </div>
        <OwnerTag owner={q.owner} />
      </div>

      <h3 id={`${id}-q`} className="heading mt-3 text-[19px] text-ink [font-variation-settings:'opsz'_24,'wdth'_92]">
        {q.question}
      </h3>
      {q.ai_worded && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-ink-faint" title={q.original_question ?? undefined}>
          <Sparkles className="h-3 w-3" aria-hidden /> AI-worded · answers are computed by code
        </p>
      )}
      <div>
        <Why id={id} why={q.why} />
      </div>
      <AnswerForm
        qid={q.id}
        options={q.options}
        customField={q.custom_field}
        initial={{ choice: q.options.find((o) => o.recommended)?.id ?? null }}
        submitLabel="Apply answer"
        onSubmit={submit}
      />
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
    <article aria-labelledby={`${id}-q`} className={cn("sheet p-5 transition-[border-color,box-shadow] duration-200", editing && "border-ink shadow-selected")}>
      <div className="flex items-center justify-between gap-3">
        <Stamp tone={passed ? "sky" : "ok"} landed={`${a.kind}|${a.answer}`}>
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          {passed ? "Passed to agency" : a.kind === "not_applicable" ? "Confirmed · not applicable" : "Confirmed"}
        </Stamp>
        <OwnerTag owner={a.owner} />
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <h3 id={`${id}-q`} className="text-[15px] font-semibold leading-snug text-ink-2">
          {a.question}
        </h3>
        {!editing && (
          <Button variant="outline" size="sm" className="shrink-0" disabled={finalized || !!busy} onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Change answer
          </Button>
        )}
      </div>
      <p className="mt-2 break-words rounded-md bg-desk/60 px-3 py-2 text-[14px] leading-snug text-ink">
        <span className="text-ink-muted">{editing ? "Current answer: " : "Answer: "}</span>
        {a.answer}
      </p>
      <p className="meta mt-2">
        {KIND_LABEL[a.kind]} · {a.by} · {new Date(a.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        {a.ai_worded && " · AI-worded"}
      </p>
      {editing && (
        <div className="anim-rise">
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
          <p className="mt-2 text-[12.5px] text-ink-muted">The earlier answer is undone first. Fields edited by hand since then are left as they are.</p>
        </div>
      )}
    </article>
  );
}
