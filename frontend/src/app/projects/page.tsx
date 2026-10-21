"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Globe, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryChip, Flag, MarketChip } from "@/components/shared/badges";
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

export default function ProjectsPage() {
  const router = useRouter();
  useSession(); // keeps the remembered open brief loaded, so the rail shows it
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
    <div className="space-y-6">
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
        <p role="alert" className="text-sm text-stop-deep">
          {error}
        </p>
      )}

      {projects === null && !error && <Loading what="projects" />}

      {projects?.length === 0 && (
        <div className="ticket mx-auto max-w-lg p-8 text-center">
          <h2 className="text-lg font-bold text-ink">No briefs yet</h2>
          <p className="mt-1 text-sm text-ink-muted">Upload a product&apos;s artwork and content sheet to build the first one.</p>
          <Button asChild className="mt-5">
            <Link href="/upload">
              New brief <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {projects && projects.length > 0 && (
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <SearchBox
                id="project-search"
                label="Search briefs"
                value={query}
                onChange={setQuery}
                placeholder="Product, market, category, situation or file name"
                count={shown.length}
                noun={["brief", "briefs"]}
                className="w-full max-w-md"
              />
              <div className="flex items-center gap-2">
                <label htmlFor="project-sort" className="text-[13px] font-semibold text-ink">
                  Sort
                </label>
                <select
                  id="project-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="h-9 rounded border border-line-strong bg-stock px-2 text-sm font-medium"
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div role="tablist" aria-label="Filter by status" className="inline-flex flex-wrap gap-1 rounded border border-line bg-stock p-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "h-8 rounded px-3 text-[13px] font-semibold transition-colors",
                      tab === t.id ? "bg-ink text-white" : "text-ink-muted hover:text-ink"
                    )}
                  >
                    {t.label} <b className="figure ml-0.5 text-[15px]">{counts[t.id]}</b>
                  </button>
                ))}
              </div>
              {filtering && (
                <p className="text-xs text-ink-muted" aria-hidden>
                  Showing {shown.length} of {projects.length}
                </p>
              )}
            </div>
          </div>

          <ul className="space-y-2" aria-label="Briefs">
            {shown.map((p, i) => {
              const current = p.session_id === sessionId;
              const fromName = nameOf(p.source_session_id);
              return (
                <li
                  key={p.session_id}
                  className={cn("ticket anim-rise grid grid-cols-1 gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center", current && "border-ink shadow-[inset_0_0_0_1px_#121514]")}
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => open(p.session_id)}
                        className="min-w-0 max-w-full text-left text-[17px] font-bold leading-snug text-ink [overflow-wrap:anywhere] hover:underline"
                      >
                        {p.product_name}
                      </button>
                      <MarketChip market={p.market} />
                      <CategoryChip category={p.category} />
                      {current && <span className="meta text-rail">Open now</span>}
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-muted">
                      {CASE_TEXT[p.case] ?? p.case}
                      {p.source_market && ` from ${p.source_market}`}
                      {fromName && <> (copy of {fromName})</>} · Updated {when(p.updated_at)}
                    </p>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.files.join(" · ")}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <span className="flex items-baseline gap-1 text-xs text-ink-muted">
                      <b className="figure text-[30px] text-ink">{p.readiness ?? 0}%</b> ready
                    </span>
                    {p.status === "finalized" ? (
                      <Flag tone="ok">Finalized</Flag>
                    ) : p.blocking_open ? (
                      <Flag tone="stop">{p.blocking_open} blocking</Flag>
                    ) : (
                      <Flag tone="ok">Ready to finalize</Flag>
                    )}
                    {p.questions_open ? <span className="text-xs text-ink-muted">{p.questions_open} questions</span> : null}
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
                      <Globe className="h-3.5 w-3.5" /> Duplicate as new market
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => open(p.session_id, "/export")}>
                      Designer brief
                    </Button>
                    <Button size="sm" onClick={() => open(p.session_id)}>
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                    <button
                      onClick={() => remove(p)}
                      className="grid h-8 w-8 place-items-center rounded text-ink-muted hover:bg-stop-soft hover:text-stop-deep"
                      aria-label={`Delete the brief for ${p.product_name}`}
                      title="Delete brief"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
            {shown.length === 0 && (
              <li className="rounded border border-dashed border-line-strong bg-stock p-6 text-center">
                <p className="text-[14px] font-semibold text-ink">
                  {query.trim() ? `No ${tab === "all" ? "" : `${TABS.find((t) => t.id === tab)?.label.toLowerCase()} `}brief matches “${query.trim()}”.` : `No ${TABS.find((t) => t.id === tab)?.label.toLowerCase()} briefs.`}
                </p>
                <p className="mt-1 text-[13px] text-ink-muted">Try a product name, a market code such as US, a category, or part of a file name.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
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
