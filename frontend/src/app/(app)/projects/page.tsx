"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Globe, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/Segmented";
import { LogoMark } from "@/components/brand/Logo";
import { CategoryChip, MarketChip, Stamp } from "@/components/shared/badges";
import { Loading, PageHead } from "@/components/shared/Notice";
import { SearchBox, matchesQuery } from "@/components/shared/SearchBox";
import { DuplicateMarketModal } from "@/components/projects/DuplicateMarketModal";
import { api } from "@/lib/api";
import { ProjectSummary, categoryLabel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";
import { useSession } from "@/components/shared/useSession";

const CASE_TEXT: Record<string, string> = { update: "Pack refresh", new_market: "New market", new_product: "New product" };

const SEARCH_KEY = "briefforge-projects-search";

type Tab = "all" | "draft" | "finalized" | "blocking";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "finalized", label: "Finalized" },
  { id: "blocking", label: "Blocking" },
];
const IN_TAB: Record<Tab, (p: ProjectSummary) => boolean> = {
  all: () => true,
  draft: (p) => p.status !== "finalized",
  finalized: (p) => p.status === "finalized",
  blocking: (p) => (p.blocking_open ?? 0) > 0 && p.status !== "finalized",
};

type Sort = "updated" | "ready_desc" | "ready_asc" | "name";
const SORTS: { id: Sort; label: string }[] = [
  { id: "updated", label: "Recently updated" },
  { id: "ready_desc", label: "Readiness, high to low" },
  { id: "ready_asc", label: "Readiness, low to high" },
  { id: "name", label: "Product name, A to Z" },
];
const COMPARE: Record<Sort, (a: ProjectSummary, b: ProjectSummary) => number> = {
  updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
  ready_desc: (a, b) => (b.readiness ?? 0) - (a.readiness ?? 0) || b.updated_at.localeCompare(a.updated_at),
  ready_asc: (a, b) => (a.readiness ?? 0) - (b.readiness ?? 0) || b.updated_at.localeCompare(a.updated_at),
  name: (a, b) => a.product_name.localeCompare(b.product_name, undefined, { sensitivity: "base" }),
};

function statusText(p: ProjectSummary) {
  if (p.status === "finalized") return "Finalized";
  return p.blocking_open ? `Draft ${p.blocking_open} blocking` : "Draft Ready to finalize";
}

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Readiness as a figure over a bar, the same reading the brief bar gives inside a brief. */
function Readiness({ p }: { p: ProjectSummary }) {
  const score = p.readiness ?? 0;
  const done = p.status === "finalized";
  return (
    <div className="w-full min-w-[150px] max-w-[220px]">
      <div className="flex items-baseline gap-1.5">
        <span className="figure text-[30px] text-ink">
          {score}
          <span className="text-[18px]">%</span>
        </span>
        <span className="text-[12.5px] text-ink-muted">ready</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-desk-2" role="presentation">
        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", done ? "bg-mint-deep" : score >= 80 ? "bg-mint-deep" : "bg-ink")} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  useSession(); // keeps the remembered open brief loaded, so "Continue" in the top bar can offer it
  const { sessionId, load, reset, busy } = useBriefStore();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [markets, setMarkets] = useState<{ code: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQueryState] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [duplicating, setDuplicating] = useState<ProjectSummary | null>(null);

  // The search is remembered for this browser tab only.
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(SEARCH_KEY);
      if (saved) setQueryState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setQuery = (v: string) => {
    setQueryState(v);
    try {
      if (v) window.sessionStorage.setItem(SEARCH_KEY, v);
      else window.sessionStorage.removeItem(SEARCH_KEY);
    } catch {
      /* storage unavailable */
    }
  };

  const refresh = useCallback(() => {
    api
      .projects()
      .then((p) => {
        setProjects(p);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(refresh, [refresh]);
  // The markets the app has rules for, the same list the upload page offers.
  useEffect(() => {
    api.standards().then((o) => setMarkets(o.markets)).catch(() => setMarkets([]));
  }, []);

  const open = async (sid: string, to = "/review") => {
    setError(null);
    const result = await load(sid);
    if (result === "ok") router.push(to);
    else if (result === "failed") {
      setError(useBriefStore.getState().error ?? "Could not open the brief.");
      refresh();
    }
    // "stale": a later click superseded this one; that click decides where to go.
  };
  const remove = async (p: ProjectSummary) => {
    if (!confirm(`Delete the brief for ${p.product_name}? Its files, answers and change log are removed from this server.`)) return;
    setError(null);
    try {
      await api.deleteProject(p.session_id);
      if (p.session_id === sessionId) reset();
    } catch (e) {
      setError(`Could not delete the brief for ${p.product_name}. ${e instanceof Error ? e.message : ""}`.trim());
    } finally {
      refresh();
    }
  };

  // Search first, so each tab's count says what that tab will show for the current search.
  const searched = useMemo(
    () =>
      (projects ?? []).filter((p) =>
        matchesQuery(query, p.product_name, p.market, `Market ${p.market}`, p.source_market ?? "", p.category ?? "",
          categoryLabel(p.category), CASE_TEXT[p.case] ?? p.case, statusText(p), ...p.files)
      ),
    [projects, query]
  );
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, searched.filter(IN_TAB[t.id]).length])) as Record<Tab, number>,
    [searched]
  );
  const shown = useMemo(() => searched.filter(IN_TAB[tab]).sort(COMPARE[sort]), [searched, tab, sort]);
  const filtering = !!query.trim() || tab !== "all";
  const clearFilters = () => {
    setQuery("");
    setTab("all");
  };
  const nameOf = (sid?: string | null) => projects?.find((x) => x.session_id === sid)?.product_name;

  return (
    <div className="space-y-8">
      <PageHead
        title="Projects"
        lead="Every packaging brief on this server. Each one keeps its own files, findings, answers and change log."
        actions={
          <Button asChild size="lg">
            <Link href="/upload" onClick={() => reset()}>
              <Plus className="h-4 w-4" /> New brief
            </Link>
          </Button>
        }
      />

      {error && (
        <div role="alert" className="anim-rise flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stop/30 bg-stop-soft px-4 py-3">
          <p className="flex items-start gap-3 text-[14px] text-ink">
            <Stamp tone="stop" className="bg-paper">
              Problem
            </Stamp>
            <span className="[overflow-wrap:anywhere]">{error}</span>
          </p>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      )}

      {projects === null && !error && <Loading what="projects" rows={3} />}

      {projects?.length === 0 && (
        <div className="anim-rise mx-auto max-w-xl pt-6">
          <div className="sheet-set px-8 py-12 text-center">
            <LogoMark className="mx-auto h-14 w-14" />
            <h2 className="heading mt-6 text-[26px] text-ink">No briefs yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink-muted">
              Upload a product&apos;s artwork and content sheet. BriefForge reads them, fills the brief with proof and lists what needs a decision.
            </p>
            <Button asChild size="lg" className="mt-7">
              <Link href="/upload" onClick={() => reset()}>
                Create the first brief <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {projects && projects.length > 0 && (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Segmented
              label="Filter by status"
              value={tab}
              onChange={setTab}
              items={TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }))}
            />
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox
                id="project-search"
                label="Search briefs"
                value={query}
                onChange={setQuery}
                placeholder="Product, market, category, situation or file"
                count={shown.length}
                noun={["brief", "briefs"]}
                className="w-full sm:w-80"
              />
              <label htmlFor="project-sort" className="sr-only">
                Sort
              </label>
              <select
                id="project-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="h-10 rounded-md border border-line-strong bg-paper px-3 text-[14px] font-medium text-ink hover:border-ink-soft focus:border-ink"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filtering && (
            <p className="-mt-4 text-[13px] text-ink-muted" aria-hidden>
              Showing {shown.length} of {projects.length}
            </p>
          )}

          <ul className="space-y-3" aria-label="Briefs">
            {shown.map((p, i) => {
              const current = p.session_id === sessionId;
              const fromName = nameOf(p.source_session_id);
              const finalized = p.status === "finalized";
              return (
                <li
                  key={p.session_id}
                  className={cn(
                    "sheet anim-rise lift-on-hover grid grid-cols-1 gap-5 p-5 md:p-6 lg:grid-cols-[minmax(0,1fr)_220px_minmax(170px,auto)_auto] lg:items-center lg:gap-8",
                    current && "border-ink shadow-selected"
                  )}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => open(p.session_id)}
                        className="heading min-w-0 max-w-full text-left text-[19px] text-ink [overflow-wrap:anywhere] hover:underline hover:decoration-2 hover:underline-offset-4"
                      >
                        {p.product_name}
                      </button>
                      {current && <Stamp tone="sky">Open now</Stamp>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <MarketChip market={p.market} />
                      <CategoryChip category={p.category} />
                      <span className="text-[13px] text-ink-muted">
                        {CASE_TEXT[p.case] ?? p.case}
                        {p.source_market && ` from ${p.source_market}`}
                        {fromName && <> · copy of {fromName}</>} · Updated {when(p.updated_at)}
                      </span>
                    </div>
                    <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-muted">
                      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">
                        {p.files.length} file{p.files.length === 1 ? "" : "s"} · {p.files.join(" · ")}
                      </span>
                    </p>
                  </div>

                  <Readiness p={p} />

                  <div className="flex flex-col items-start gap-1.5">
                    {finalized ? (
                      <Stamp tone="ok">Finalized</Stamp>
                    ) : p.blocking_open ? (
                      <Stamp tone="stop">{p.blocking_open} blocking</Stamp>
                    ) : (
                      <Stamp tone="ok">Ready to finalize</Stamp>
                    )}
                    <span className="text-[12.5px] text-ink-muted">
                      {p.questions_open ? `${p.questions_open} question${p.questions_open === 1 ? "" : "s"} open` : finalized ? "Handed off" : "No open questions"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!busy || markets.filter((m) => m.code !== p.market).length === 0}
                      onClick={() => setDuplicating(p)}
                      aria-haspopup="dialog"
                      title="A new brief from the same files, checked against another market's rules"
                    >
                      <Globe className="h-3.5 w-3.5" /> New market<span className="sr-only"> (duplicate as new market)</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => open(p.session_id, "/export")}>
                      Designer brief
                    </Button>
                    <span className="flex items-center gap-2">
                    <Button size="sm" onClick={() => open(p.session_id)}>
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                    <button
                      onClick={() => remove(p)}
                      className="pressable grid h-8 w-8 place-items-center rounded-md text-ink-muted transition-colors hover:bg-stop-soft hover:text-stop-deep"
                      aria-label={`Delete the brief for ${p.product_name}`}
                      title="Delete brief"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    </span>
                  </div>
                </li>
              );
            })}
            {shown.length === 0 && (
              <li className="rounded-lg border border-dashed border-line-strong bg-paper/60 px-6 py-10 text-center">
                <p className="heading text-[18px] text-ink">
                  {query.trim() ? `No ${tab === "all" ? "" : `${TABS.find((t) => t.id === tab)?.label.toLowerCase()} `}brief matches “${query.trim()}”.` : `No ${TABS.find((t) => t.id === tab)?.label.toLowerCase()} briefs.`}
                </p>
                <p className="mt-1.5 text-[14px] text-ink-muted">Try a product name, a market code such as US, a category, or part of a file name.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              </li>
            )}
          </ul>
        </>
      )}

      <DuplicateMarketModal source={duplicating} markets={markets} onClose={() => setDuplicating(null)} />
    </div>
  );
}
