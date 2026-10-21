"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryChip, MarketChip } from "@/components/shared/badges";
import { api } from "@/lib/api";
import { PRODUCT_CATEGORIES, ProjectSummary } from "@/lib/types";
import { useBriefStore } from "@/store/briefStore";

type Market = { code: string; label: string };

const EDITION = /\s*\([A-Z]{2,5} Edition\)$/;
const defaultName = (name: string, market: string) => `${name.replace(EDITION, "")} (${market} Edition)`;

/**
 * Adapts an existing brief to another market as a new brief. The same files are read again against the target
 * market's rules; the source brief is not changed and its decisions are not copied.
 */
export function DuplicateMarketModal({
  source,
  markets,
  onClose,
}: {
  source: ProjectSummary | null;
  markets: Market[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { start, busy, error, clearError } = useBriefStore();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const targets = markets.filter((m) => m.code !== source?.market);
  const [market, setMarket] = useState("");
  const [category, setCategory] = useState("food");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [failed, setFailed] = useState(false);
  const [working, setWorking] = useState(false);

  // Fresh form for each brief the dialog opens on.
  useEffect(() => {
    if (!source) return;
    const first = targets.find((m) => m.code === "US")?.code ?? targets[0]?.code ?? "";
    setMarket(first);
    setCategory(source.category ?? "food");
    setName(first ? defaultName(source.product_name, first) : "");
    setNameEdited(false);
    setFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.session_id]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (source && !d.open) d.showModal();
    if (!source && d.open) d.close();
  }, [source]);

  // The name follows the market until someone types their own.
  const pickMarket = (code: string) => {
    setMarket(code);
    if (!nameEdited && source) setName(defaultName(source.product_name, code));
  };

  const close = () => {
    if (working) return;
    if (failed) clearError();
    setFailed(false);
    onClose();
  };

  const submit = async () => {
    if (!source || !market) return;
    setFailed(false);
    setWorking(true);
    const ok = await start(
      () => api.duplicateMarket(source.session_id, market, category, name.trim() || undefined),
      `Adapting ${source.product_name} for ${market}`
    );
    setWorking(false);
    if (ok) {
      onClose();
      router.push("/review");
    } else setFailed(true);
  };

  const labelFor = (code?: string | null) => markets.find((m) => m.code === code)?.label ?? code ?? "";

  return (
    <dialog
      ref={dialog}
      onClose={close}
      onCancel={(e) => {
        if (working) e.preventDefault();
      }}
      aria-labelledby="dup-market-h"
      className="w-[min(540px,calc(100vw-32px))] rounded border border-line bg-stock p-0 text-ink shadow-lift backdrop:bg-ink/40"
    >
      {source && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id="dup-market-h" className="text-[18px] font-bold">
                Duplicate as new market
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-muted">
                <span className="truncate font-semibold text-ink">{source.product_name}</span>
                <MarketChip market={source.market} />
                <CategoryChip category={source.category} />
              </p>
            </div>
            <button type="button" onClick={close} className="grid h-8 w-8 shrink-0 place-items-center rounded hover:bg-ink/5" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <p className="text-[13px] leading-relaxed text-ink-2">
              A new brief is made from the same files and checked against the target market&apos;s rules. Where the{" "}
              {labelFor(source.market)} pack differs, the designer is told to change it. This brief stays as it is; its answers and
              sign-offs are not copied, because they were made for {labelFor(source.market)}.
            </p>
            {failed && error && (
              <p role="alert" className="rounded border border-stop/40 bg-stop-soft px-3 py-2 text-[13px] text-ink">
                <b className="font-semibold">The brief was not duplicated.</b> {error}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="dup-market" className="text-[13px] font-semibold">
                  Target market
                </label>
                <select
                  id="dup-market"
                  value={market}
                  onChange={(e) => pickMarket(e.target.value)}
                  required
                  className="mt-1 h-9 w-full rounded border border-line-strong bg-stock px-2 text-sm font-medium"
                >
                  {targets.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="dup-category" className="text-[13px] font-semibold">
                  Product category
                </label>
                <select
                  id="dup-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-line-strong bg-stock px-2 text-sm font-medium"
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="dup-name" className="text-[13px] font-semibold">
                Product name <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <input
                id="dup-name"
                value={name}
                maxLength={120}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameEdited(true);
                }}
                className="mt-1 h-9 w-full rounded border border-line-strong bg-stock px-3 text-sm focus:border-ink"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
            <Button type="button" variant="ghost" onClick={close} disabled={working}>
              Cancel
            </Button>
            <Button type="submit" disabled={!market || working || !!busy}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Globe className="h-4 w-4" aria-hidden />}
              {working ? "Building the new brief…" : `Create ${market || "new"} brief`}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
