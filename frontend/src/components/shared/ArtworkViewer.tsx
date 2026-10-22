"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, Minus, MousePointerClick, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BriefField, DesignAction, PageView, Panel } from "@/lib/types";
import { useBriefStore } from "@/store/briefStore";
import { ACTION_META } from "./badges";
import { sourceLabel } from "./SourceChip";

interface Props {
  pages: PageView[];
  panels: Panel[];
  panelActions?: Record<string, DesignAction[]>;
  className?: string;
  height?: string;
  /** Talk to the Pack: fields whose text sits on the artwork become boxes that can be clicked to inspect them. */
  inspectable?: BriefField[];
  inspected?: string | null;
  onInspect?: (key: string) => void;
}

export function ArtworkViewer({ pages, panels, panelActions, className, height = "max-h-[560px]", inspectable, inspected, onInspect }: Props) {
  const { highlight, setHighlight } = useBriefStore();
  const [zoom, setZoom] = useState(1);
  const [showPanels, setShowPanels] = useState(true);
  const [talk, setTalk] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const firstBox = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const page = pages.find((p) => p.file.toLowerCase().endsWith(".pdf")) ?? pages[0];

  // A small target gets a closer look: zoom in so the spot is legible.
  useEffect(() => {
    const first = highlight?.sources.find((s) => s.bbox);
    if (!first?.bbox || !page) return;
    const w = (first.bbox[2] - first.bbox[0]) / page.width;
    if (w >= 0.08) return;
    // Zoom so the spot is legible and the pane can scroll to centre it (image taller than the pane).
    const pane = scroller.current;
    let target = 2;
    if (pane?.clientWidth) {
      const ratio = page.height / page.width;
      const maxH = parseFloat(getComputedStyle(pane).maxHeight) || pane.clientHeight || 400;
      while (target < 4 && pane.clientWidth * target * ratio < maxH * 1.35) target += 0.5;
    }
    setZoom((z) => Math.max(z, target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);

  // Bring the highlighted spot into view inside the artwork pane only (never scroll the page).
  // Positions come from the source's page coordinates and the image's rendered size, so the
  // result does not depend on in-flight animations or on how often this runs.
  useEffect(() => {
    const target = highlight?.sources.find((s) => s.bbox && (s.page ?? 1) === page?.page && s.file === page?.file);
    const pane = scroller.current;
    const img = imgRef.current;
    if (!target?.bbox || !pane || !img || !page) return;
    if (img.complete && img.naturalWidth) setLoaded(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const aim = () => {
      if (!img.offsetHeight || !pane.clientHeight) return;
      const [x0, y0, x1, y1] = target.bbox!;
      const cx = ((x0 + x1) / 2 / page.width) * img.offsetWidth;
      const cy = ((y0 + y1) / 2 / page.height) * img.offsetHeight;
      pane.scrollTo({
        left: Math.max(0, cx - pane.clientWidth / 2),
        top: Math.max(0, cy - pane.clientHeight / 2),
        behavior: reduce ? "auto" : "smooth",
      });
    };
    // Re-aim whenever the rendered image or the pane changes size (load, zoom, layout, rotation).
    const ro = new ResizeObserver(() => aim());
    ro.observe(img);
    ro.observe(pane);
    aim();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight, zoom, loaded]);

  if (!page) {
    return (
      <div className={cn("sheet flex flex-col items-center justify-center p-6 text-center", height, className)}>
        <p className="heading text-[17px] text-ink">No artwork in this brief</p>
        <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-ink-muted">Values come from the content sheet and notes. Upload a packaging PDF to check placement on the pack.</p>
      </div>
    );
  }

  const pct = (b: number[]) => ({
    left: `${(b[0] / page.width) * 100}%`,
    top: `${(b[1] / page.height) * 100}%`,
    width: `${((b[2] - b[0]) / page.width) * 100}%`,
    height: `${((b[3] - b[1]) / page.height) * 100}%`,
  });
  // Grow tiny targets to a minimum visible frame (about 2.5% of the page width), centred on the spot.
  const minBox = (b: number[]) => {
    const min = page.width * 0.025;
    const w = Math.max(b[2] - b[0] + 6, min);
    const h = Math.max(b[3] - b[1] + 6, min * 0.7);
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
  };
  const boxes = (highlight?.sources ?? []).filter((s) => s.bbox && (s.page ?? 1) === page.page && s.file === page.file);
  // One box per field printed on this page: where its current value sits, else where the artwork shows it.
  const onPage = (s: { bbox?: number[] | null; page?: number | null; file: string; kind: string }) =>
    s.kind === "pdf" && !!s.bbox && (s.page ?? 1) === page.page && s.file === page.file;
  const fieldBoxes = onInspect && talk
    ? (inspectable ?? []).flatMap((f) => {
        const src = f.sources.find(onPage) ?? f.candidates.map((c) => c.source).find(onPage);
        return src?.bbox ? [{ key: f.key, label: f.label, status: f.status, bbox: src.bbox }] : [];
      })
    : [];
  const shownPanels = panels.filter((p) => p.page === page.page && p.file === page.file && !p.id.startsWith("tuck"));

  return (
    <section aria-label="Artwork" className={cn("sheet flex min-w-0 flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line py-1.5 pl-4 pr-2">
        <h2 className="text-[13.5px] font-semibold text-ink">Artwork</h2>
        <div className="flex items-center gap-0.5">
          {onInspect && (
            <button
              className={cn("pressable grid h-9 w-9 place-items-center rounded-md transition-colors", talk ? "bg-canary-soft text-ink" : "text-ink-faint hover:bg-ink/[0.06]")}
              aria-pressed={talk}
              aria-label="Talk to the Pack: click elements on the artwork"
              title="Talk to the Pack"
              onClick={() => setTalk((v) => !v)}
            >
              <MousePointerClick className="h-4 w-4" />
            </button>
          )}
          <button
            className={cn("pressable grid h-9 w-9 place-items-center rounded-md transition-colors", showPanels ? "bg-desk text-ink" : "text-ink-faint hover:bg-ink/[0.06]")}
            aria-pressed={showPanels}
            aria-label="Show panel outlines"
            title="Panel outlines"
            onClick={() => setShowPanels((v) => !v)}
          >
            <Layers className="h-4 w-4" />
          </button>
          <button className="pressable grid h-9 w-9 place-items-center rounded-md hover:bg-ink/[0.06] disabled:opacity-40" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-11 text-center text-[12.5px] font-semibold tabular-nums text-ink-muted">{Math.round(zoom * 100)}%</span>
          <button className="pressable grid h-9 w-9 place-items-center rounded-md hover:bg-ink/[0.06] disabled:opacity-40" aria-label="Zoom in" disabled={zoom >= 4} onClick={() => setZoom((z) => Math.min(4, z + 0.5))}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scroller} className={cn("relative overflow-auto bg-[#F1F2F6] [background-image:radial-gradient(rgba(21,24,43,0.09)_1px,transparent_1px)] [background-size:14px_14px]", height)}>
        <div className="relative" style={{ width: `${zoom * 100}%` }}>
          {!loaded && <div className="skeleton absolute inset-0" aria-hidden />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={page.url}
            alt={`Flat dieline of ${page.file}`}
            onLoad={() => setLoaded(true)}
            className={cn("block w-full select-none transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
            draggable={false}
          />
          {showPanels &&
            shownPanels.map((p) => {
              const acts = panelActions?.[p.id] ?? [];
              return (
                <div key={p.id} className="pointer-events-none absolute border border-dashed border-ink/40" style={pct(p.bbox)}>
                  <span
                    className={cn(
                      "absolute left-0 top-0 max-w-full truncate rounded-br-[4px] px-1.5 py-0.5 text-[10.5px] font-semibold leading-tight empty:hidden",
                      p.is_main ? "bg-ink text-white" : "bg-paper/90 text-ink"
                    )}
                  >
                    {p.is_main || !p.id.includes("_") ? p.label : null}
                  </span>
                  {acts.length > 0 && (
                    <span className="absolute bottom-1 left-1 flex flex-wrap gap-0.5">
                      {Array.from(new Set(acts)).map((a) => (
                        <span key={a} className={cn("rounded-sm px-1 text-[10px] font-bold uppercase leading-4", ACTION_META[a].cls)}>
                          {ACTION_META[a].text} {acts.filter((x) => x === a).length}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          {fieldBoxes.map((b) => (
            <button
              key={`field-${b.key}`}
              type="button"
              onClick={() => onInspect?.(b.key)}
              aria-label={`Inspect ${b.label}`}
              aria-pressed={inspected === b.key}
              title={b.label}
              className={cn(
                "absolute rounded-sm outline-none transition-[box-shadow,background-color] duration-150",
                "hover:bg-canary/25 hover:shadow-[0_0_0_2px_#15182B] focus-visible:shadow-[0_0_0_3px_#15182B]",
                inspected === b.key
                  ? "bg-canary/30 shadow-[0_0_0_3px_#15182B]"
                  : b.status === "needs_review"
                    ? "shadow-[0_0_0_1.5px_#E5B800]"
                    : "shadow-[0_0_0_1px_rgba(21,24,43,0.32)]"
              )}
              style={pct(minBox(b.bbox))}
            />
          ))}
          {boxes.map((s, i) => (
            <div
              key={`${highlight?.label}-${i}`}
              ref={i === 0 ? firstBox : undefined}
              className="anim-stamp pointer-events-none absolute rounded-sm border-[3px] border-ink bg-canary/50 shadow-[0_0_0_3px_#FFFFFF,0_6px_18px_rgba(21,24,43,0.35)]"
              style={pct(minBox(s.bbox!))}
            />
          ))}
        </div>
      </div>

      <div className="flex min-h-11 items-center justify-between gap-2 border-t border-line py-2 pl-4 pr-2">
        {highlight ? (
          <>
            <p className="min-w-0 text-[12.5px] leading-relaxed">
              <span className="font-semibold text-ink">Showing: {highlight.label}</span>
              {boxes.length === 0 ? (
                <span className="text-ink-muted"> · not on the artwork (content sheet or image)</span>
              ) : (
                <span className="whitespace-nowrap tabular-nums text-ink-muted"> · {sourceLabel(boxes[0])}</span>
              )}
            </p>
            <button onClick={() => setHighlight(null)} className="pressable grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-ink/[0.06]" aria-label="Clear highlight">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <p className="truncate meta text-ink-muted">
            {page.file} · {shownPanels.length} panels · {fieldBoxes.length ? "click an element on the pack to inspect it" : "click any source to locate it"}
          </p>
        )}
      </div>
    </section>
  );
}
