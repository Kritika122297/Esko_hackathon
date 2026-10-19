"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/shared/badges";
import { Loading, PageHead } from "@/components/shared/Notice";
import { api } from "@/lib/api";
import { ProjectSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";
import { useSession } from "@/components/shared/useSession";

const CASE_TEXT: Record<string, string> = { update: "Pack refresh", new_market: "New market", new_product: "New product" };

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ProjectsPage() {
  const router = useRouter();
  useSession(); // keeps the remembered open brief loaded, so the rail shows it
  const { sessionId, load, reset } = useBriefStore();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refresh = useCallback(() => {
    api.projects().then(setProjects).catch((e) => setError(e.message));
  }, []);
  useEffect(refresh, [refresh]);

  const open = async (sid: string, to = "/review") => {
    await load(sid);
    router.push(to);
  };
  const remove = async (p: ProjectSummary) => {
    if (!confirm(`Delete the brief for ${p.product_name}? Its files, answers and change log are removed from this server.`)) return;
    await api.deleteProject(p.session_id);
    if (p.session_id === sessionId) reset();
    refresh();
  };

  const q = query.trim().toLowerCase();
  const shown = (projects ?? []).filter((p) => !q || `${p.product_name} ${p.files.join(" ")}`.toLowerCase().includes(q));

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
          {projects.length > 4 && (
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <label htmlFor="project-search" className="sr-only">
                Find a brief
              </label>
              <input
                id="project-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find by product or file name"
                className="h-10 w-full rounded border border-line-strong bg-stock pl-9 pr-3 text-sm focus:border-ink"
              />
            </div>
          )}
          <ul className="space-y-2" aria-label="Briefs">
            {shown.map((p, i) => {
              const current = p.session_id === sessionId;
              return (
                <li
                  key={p.session_id}
                  className={cn("ticket anim-rise grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center", current && "border-ink shadow-[inset_0_0_0_1px_#121514]")}
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => open(p.session_id)} className="truncate text-left text-[17px] font-bold text-ink hover:underline">
                        {p.product_name}
                      </button>
                      {current && <span className="meta text-rail">Open now</span>}
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-muted">
                      {CASE_TEXT[p.case] ?? p.case} · Market {p.market} · Updated {when(p.updated_at)}
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

                  <div className="flex items-center gap-2 md:justify-end">
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
            {shown.length === 0 && <li className="text-sm text-ink-muted">No brief matches “{query}”.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
