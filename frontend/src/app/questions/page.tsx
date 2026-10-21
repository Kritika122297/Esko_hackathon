"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnsweredCard, QuestionCard } from "@/components/questions/QuestionCard";
import { ErrorBanner, NoSession, PageHead, SessionPending } from "@/components/shared/Notice";
import { SearchBox, matchesQuery } from "@/components/shared/SearchBox";
import { useSession } from "@/components/shared/useSession";
import { cn } from "@/lib/utils";

const OWNER_ORDER = ["R&D", "Legal", "Supply Chain", "Brand", "Agency"];
const slug = (o: string) => o.replace(/[^a-z]/gi, "");
type Tab = "open" | "answered";

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} of ${total} answered`}
      className="h-1.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div className="h-full rounded-full bg-rail transition-[width] duration-300 ease-out" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
  );
}

export default function QuestionsPage() {
  const { ready, sessionId, view } = useSession();
  const [picked, setPicked] = useState<Tab | null>(null);
  const [query, setQuery] = useState("");
  if (!ready) return null;
  if (!sessionId) return <NoSession />;
  if (!view) return <SessionPending what="questions" />;

  const qs = view.state.questions;
  const openIds = new Set(qs.map((q) => q.id));
  // A question that came back open (e.g. after an undo) is shown open, not answered.
  const answered = (view.state.answered_questions ?? []).filter((a) => !openIds.has(a.id));
  const owners = OWNER_ORDER.filter((o) => qs.some((q) => q.owner === o) || answered.some((a) => a.owner === o));
  const must = qs.filter((q) => q.priority === "must_answer").length;
  const tab: Tab = picked ?? (qs.length || !answered.length ? "open" : "answered");
  const counts: Record<Tab, number> = { open: qs.length, answered: answered.length };
  // The search narrows the cards in the current tab; tab counts and owner progress keep showing totals.
  const searching = query.trim().length > 0;
  const openHits = qs.filter((q) => matchesQuery(query, q.question, q.why, q.owner));
  const answeredHits = answered.filter((a) => matchesQuery(query, a.question, a.why, a.owner, a.answer, a.note));
  const hits = tab === "open" ? openHits : answeredHits;
  const shown = owners.filter((o) => hits.some((x) => x.owner === o));
  let n = -1;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHead
        title={qs.length ? "Questions" : answered.length ? "All questions answered" : "No open questions"}
        lead={
          qs.length
            ? `${must} must be answered before handoff, ${qs.length - must} should be. Suggested answers are calculated by code from your own files; you can always type your own.`
            : "Every decision is answered or passed to the agency as an open question. Answers can still be changed."
        }
        actions={
          <Button asChild variant={qs.length ? "outline" : "default"}>
            <Link href="/review">
              Go to workbench <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <ErrorBanner />

      {owners.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div role="tablist" aria-label="Questions" className="grid w-full grid-cols-2 gap-1 rounded border border-line bg-stock p-1 sm:inline-grid sm:w-auto sm:min-w-[360px]">
              {(["open", "answered"] as const).map((k) => (
                <button
                  key={k}
                  id={`tab-${k}`}
                  role="tab"
                  aria-selected={tab === k}
                  aria-controls={`panel-${k}`}
                  onClick={() => setPicked(k)}
                  className={cn("h-9 rounded px-4 text-[13px] font-semibold transition-colors", tab === k ? "bg-ink text-white" : "text-ink-muted hover:text-ink")}
                >
                  {k === "open" ? "To answer" : "Answered"} <b className="figure ml-0.5 text-[16px]">{counts[k]}</b>
                </button>
              ))}
            </div>
            <SearchBox
              id="question-search"
              label="Search questions"
              value={query}
              onChange={setQuery}
              placeholder={tab === "open" ? "Search question, reason or owner" : "Search question, answer or owner"}
              count={hits.length}
              noun={["question", "questions"]}
              className="w-full sm:w-80"
            />
            {searching && (
              <p className="text-xs text-ink-muted" aria-hidden>
                Showing {hits.length} of {counts[tab]}
              </p>
            )}
          </div>

          <nav aria-label="Progress by owner" className="flex flex-wrap gap-2">
            {owners.map((o) => {
              const done = answered.filter((a) => a.owner === o).length;
              const total = done + qs.filter((q) => q.owner === o).length;
              const here = shown.includes(o);
              return (
                <a
                  key={o}
                  href={here ? `#owner-${slug(o)}` : undefined}
                  aria-disabled={!here}
                  className={cn(
                    "rounded border border-line bg-stock px-2.5 py-1 text-xs font-semibold text-ink",
                    here ? "hover:border-ink" : "opacity-60"
                  )}
                >
                  {o}{" "}
                  <b className="figure ml-1 text-[15px]">
                    {done}/{total}
                  </b>
                </a>
              );
            })}
          </nav>
        </div>
      )}

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-6">
        {owners.length > 0 && shown.length === 0 && searching && counts[tab] > 0 && (
          <div className="rounded border border-dashed border-line-strong bg-stock p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">No question {tab === "open" ? "to answer" : "answered"} matches “{query.trim()}”.</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {(tab === "open" ? answeredHits : openHits).length > 0
                ? `${(tab === "open" ? answeredHits : openHits).length} matching under ${tab === "open" ? "Answered" : "To answer"}.`
                : "Try another word, or clear the search."}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                Clear search
              </Button>
              {(tab === "open" ? answeredHits : openHits).length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setPicked(tab === "open" ? "answered" : "open")}>
                  {tab === "open" ? "See answered matches" : "See matches to answer"}
                </Button>
              )}
            </div>
          </div>
        )}

        {owners.length > 0 && shown.length === 0 && !(searching && counts[tab] > 0) && (
          <div className="rounded border border-dashed border-line-strong bg-stock p-6 text-center">
            <p className="text-[14px] font-semibold text-ink">{tab === "open" ? "Nothing left to answer." : "No answers yet."}</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {tab === "open" ? "Review or change earlier answers under Answered." : "Answers appear here once you apply them under To answer."}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setPicked(tab === "open" ? "answered" : "open")}>
              {tab === "open" ? "See answered questions" : "See questions to answer"}
            </Button>
          </div>
        )}

        {shown.map((owner) => {
          const open = qs.filter((q) => q.owner === owner);
          const done = answered.filter((a) => a.owner === owner);
          const total = open.length + done.length;
          const openShown = openHits.filter((q) => q.owner === owner);
          const doneShown = answeredHits.filter((a) => a.owner === owner);
          return (
            <section key={owner} id={`owner-${slug(owner)}`} aria-labelledby={`h-${slug(owner)}`} className="scroll-mt-24 space-y-3">
              <div className="space-y-2">
                <div className="section-rule">
                  <h2 id={`h-${slug(owner)}`} className="text-[16px] font-bold text-ink">
                    For {owner}
                  </h2>
                  <span className="text-xs tabular-nums text-ink-muted">
                    {done.length} of {total} answered
                  </span>
                </div>
                <Progress done={done.length} total={total} label={`${owner} questions answered`} />
              </div>
              {tab === "open"
                ? openShown.map((q) => {
                    n += 1;
                    return <QuestionCard key={q.id} q={q} index={n} />;
                  })
                : doneShown
                    .slice()
                    .reverse()
                    .map((a) => <AnsweredCard key={a.id} a={a} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
