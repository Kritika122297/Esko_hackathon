"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/Segmented";
import { RollingNumber } from "@/components/ui/RollingNumber";
import { AnsweredCard, QuestionCard } from "@/components/questions/QuestionCard";
import { ErrorBanner, NoSession, PageHead, SessionPending } from "@/components/shared/Notice";
import { SearchBox, matchesQuery } from "@/components/shared/SearchBox";
import { useSession } from "@/components/shared/useSession";
import { cn } from "@/lib/utils";

const OWNER_ORDER = ["R&D", "Legal", "Supply Chain", "Brand", "Agency"];
const slug = (o: string) => o.replace(/[^a-z]/gi, "");
type Tab = "open" | "answered";

function Progress({ done, total, label, className }: { done: number; total: number; label: string; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} of ${total} answered`}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-desk-2", className)}
    >
      <div
        className={cn("h-full origin-left rounded-full transition-transform duration-700 ease-out", done === total ? "bg-mint-deep" : "bg-ink")}
        style={{ transform: `scaleX(${total ? done / total : 0})` }}
      />
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
  const totalAll = qs.length + answered.length;
  let n = -1;

  return (
    <div className="mx-auto max-w-[1180px] space-y-8">
      <PageHead
        title={qs.length ? "Questions" : answered.length ? "All questions answered" : "No open questions"}
        lead={
          qs.length
            ? `${must} must be answered before handoff, ${qs.length - must} should be. Suggested answers are calculated by code from your own files; you can always type your own.`
            : "Every decision is answered or passed to the agency as an open question. Answers can still be changed."
        }
        actions={
          <Button asChild variant={qs.length ? "outline" : "default"} size="lg">
            <Link href="/review">
              Go to workbench <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <ErrorBanner />

      {owners.length > 0 && (
        <>
          {/* Routing board: who is being waited on, and how far each owner has got */}
          <nav aria-label="Progress by owner" className="sheet grid overflow-hidden sm:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex items-center gap-4 border-b border-line bg-desk/40 p-5 sm:flex-col sm:items-start sm:justify-center sm:border-b-0 sm:border-r">
              <div className="flex items-baseline gap-1">
                <RollingNumber value={answered.length} className="text-[44px] text-ink" label={`${answered.length} answered`} />
                <span className="figure text-[24px] text-ink-faint">/{totalAll}</span>
              </div>
              <p className="text-[13px] leading-snug text-ink-muted">questions answered or passed on</p>
            </div>
            <ul className="flex flex-wrap">
              {owners.map((o) => {
                const done = answered.filter((a) => a.owner === o).length;
                const total = done + qs.filter((q) => q.owner === o).length;
                const here = shown.includes(o);
                return (
                  <li key={o} className="min-w-[160px] flex-1 border-b border-line bg-paper sm:border-b-0 [&:not(:first-child)]:border-l">
                    <a
                      href={here ? `#owner-${slug(o)}` : undefined}
                      aria-disabled={!here}
                      className={cn("flex h-full flex-col gap-2.5 p-4 transition-colors", here ? "hover:bg-desk/50" : "opacity-55")}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[13.5px] font-semibold text-ink">{o}</span>
                        <span className="figure text-[20px] text-ink">
                          {done}
                          <span className="text-ink-faint">/{total}</span>
                        </span>
                      </span>
                      <Progress done={done} total={total} label={`${o} questions answered`} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Segmented
              label="Questions"
              idPrefix="q"
              value={tab}
              onChange={setPicked}
              items={[
                { id: "open", label: "To answer", count: counts.open },
                { id: "answered", label: "Answered", count: counts.answered },
              ]}
            />
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
              <p className="text-[13px] text-ink-muted" aria-hidden>
                Showing {hits.length} of {counts[tab]}
              </p>
            )}
          </div>
        </>
      )}

      <div id={`q-panel-${tab}`} role="tabpanel" aria-labelledby={`q-tab-${tab}`} className="space-y-10">
        {owners.length > 0 && shown.length === 0 && searching && counts[tab] > 0 && (
          <div className="rounded-lg border border-dashed border-line-strong bg-paper/60 px-6 py-10 text-center">
            <p className="heading text-[18px] text-ink">No question {tab === "open" ? "to answer" : "answered"} matches “{query.trim()}”.</p>
            <p className="mt-1.5 text-[14px] text-ink-muted">
              {(tab === "open" ? answeredHits : openHits).length > 0
                ? `${(tab === "open" ? answeredHits : openHits).length} matching under ${tab === "open" ? "Answered" : "To answer"}.`
                : "Try another word, or clear the search."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
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
          <div className="anim-rise rounded-lg border border-dashed border-line-strong bg-paper/60 px-6 py-12 text-center">
            <p className="heading text-[20px] text-ink">{tab === "open" ? "Nothing left to answer." : "No answers yet."}</p>
            <p className="mt-1.5 text-[14px] text-ink-muted">
              {tab === "open" ? "Review or change earlier answers under Answered." : "Answers appear here once you apply them under To answer."}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setPicked(tab === "open" ? "answered" : "open")}>
              {tab === "open" ? "See answered questions" : "See questions to answer"}
            </Button>
          </div>
        )}

        {owners.length === 0 && (
          <div className="anim-rise mx-auto max-w-lg">
            <div className="sheet-set px-8 py-10 text-center">
              <p className="heading text-[22px] text-ink">Nothing to decide</p>
              <p className="mt-2 text-[14px] text-ink-muted">This brief raised no questions. Review the values in the workbench.</p>
            </div>
          </div>
        )}

        {shown.map((owner) => {
          const open = qs.filter((q) => q.owner === owner);
          const done = answered.filter((a) => a.owner === owner);
          const total = open.length + done.length;
          const openShown = openHits.filter((q) => q.owner === owner);
          const doneShown = answeredHits.filter((a) => a.owner === owner);
          return (
            <section key={owner} id={`owner-${slug(owner)}`} aria-labelledby={`h-${slug(owner)}`} className="scroll-mt-40 space-y-4">
              <div className="space-y-2.5">
                <div className="section-rule">
                  <h2 id={`h-${slug(owner)}`} className="heading text-[21px] text-ink">
                    For {owner}
                  </h2>
                  <span className="text-[13px] tabular-nums text-ink-muted">
                    {done.length} of {total} answered
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                {tab === "open"
                  ? openShown.map((q) => {
                      n += 1;
                      return <QuestionCard key={q.id} q={q} index={n} />;
                    })
                  : doneShown
                      .slice()
                      .reverse()
                      .map((a) => <AnsweredCard key={a.id} a={a} />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
