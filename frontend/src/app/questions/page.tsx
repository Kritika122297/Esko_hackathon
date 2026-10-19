"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/questions/QuestionCard";
import { ErrorBanner, Loading, NoSession, PageHead } from "@/components/shared/Notice";
import { useSession } from "@/components/shared/useSession";

const OWNER_ORDER = ["R&D", "Legal", "Supply Chain", "Brand", "Agency"];

export default function QuestionsPage() {
  const { ready, sessionId, view } = useSession();
  if (!ready) return null;
  if (!sessionId) return <NoSession />;
  if (!view) return <Loading what="questions" />;

  const qs = view.state.questions;
  const owners = OWNER_ORDER.filter((o) => qs.some((q) => q.owner === o));
  const must = qs.filter((q) => q.priority === "must_answer").length;
  let n = -1;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHead
        title={qs.length ? "Questions" : "No open questions"}
        lead={
          qs.length
            ? `${must} must be answered before handoff, ${qs.length - must} should be. Suggested answers are calculated by code from your own files; you can always type your own.`
            : "Every decision is answered or passed to the agency as an open question."
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

      {qs.length > 0 && (
        <nav aria-label="Questions by owner" className="flex flex-wrap gap-2">
          {owners.map((o) => (
            <a key={o} href={`#owner-${o.replace(/[^a-z]/gi, "")}`} className="rounded border border-line bg-stock px-2.5 py-1 text-xs font-semibold text-ink hover:border-ink">
              {o} <b className="figure ml-1 text-[15px]">{qs.filter((q) => q.owner === o).length}</b>
            </a>
          ))}
        </nav>
      )}

      {owners.map((owner) => (
        <section key={owner} id={`owner-${owner.replace(/[^a-z]/gi, "")}`} aria-labelledby={`h-${owner.replace(/[^a-z]/gi, "")}`} className="scroll-mt-24 space-y-3">
          <div className="section-rule">
            <h2 id={`h-${owner.replace(/[^a-z]/gi, "")}`} className="text-[16px] font-bold text-ink">
              For {owner}
            </h2>
            <span className="text-xs text-ink-muted">{qs.filter((q) => q.owner === owner).length} to answer</span>
          </div>
          {qs
            .filter((q) => q.owner === owner)
            .map((q) => {
              n += 1;
              return <QuestionCard key={q.id} q={q} index={n} />;
            })}
        </section>
      ))}
    </div>
  );
}
