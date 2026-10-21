"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SegmentItem<T extends string> {
  id: T;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

/**
 * Tabs as a segmented control. One ink indicator slides to the selected option; the first
 * paint places it without motion so it never sweeps in on load.
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  size = "md",
  className,
  stretch,
  wrapRows,
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  /** When set, tabs get ids `${idPrefix}-tab-${id}` and control `${idPrefix}-panel-${id}`. */
  idPrefix?: string;
  size?: "sm" | "md";
  className?: string;
  stretch?: boolean;
  /** Let options wrap onto more rows instead of scrolling sideways. */
  wrapRows?: boolean;
}) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const btn = el.querySelector<HTMLButtonElement>(`[data-seg="${value}"]`);
      if (btn) setBox({ x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, items.length]);

  useLayoutEffect(() => {
    if (!box || animate) return;
    const t = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(t);
  }, [box, animate]);

  const move = (dir: 1 | -1, from: T) => {
    const enabled = items.filter((i) => !i.disabled);
    const i = enabled.findIndex((x) => x.id === from);
    const next = enabled[(i + dir + enabled.length) % enabled.length];
    if (next) {
      onChange(next.id);
      wrap.current?.querySelector<HTMLButtonElement>(`[data-seg="${next.id}"]`)?.focus();
    }
  };

  return (
    <div
      ref={wrap}
      role="tablist"
      aria-label={label}
      className={cn(
        "relative inline-flex max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-md border border-line bg-paper p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        stretch && "flex w-full",
        wrapRows && "flex-wrap overflow-visible",
        className
      )}
    >
      {box && (
        <span
          aria-hidden
          className={cn("absolute left-0 top-0 w-[100px] rounded-[5px] bg-ink", animate && "seg-indicator")}
          style={{ height: box.h, transform: `translate(${box.x}px, ${box.y}px) scaleX(${box.w / 100})` }}
        />
      )}
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            data-seg={it.id}
            id={idPrefix ? `${idPrefix}-tab-${it.id}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${it.id}` : undefined}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            disabled={it.disabled}
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") (e.preventDefault(), move(1, it.id));
              if (e.key === "ArrowLeft") (e.preventDefault(), move(-1, it.id));
            }}
            className={cn(
              "relative z-[1] inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] font-semibold transition-colors duration-200 disabled:opacity-40",
              size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]",
              stretch && "flex-1",
              on ? "text-white" : "text-ink-muted hover:text-ink",
              // Before the indicator is measured, the selected option paints its own fill.
              on && !box && "bg-ink"
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span className={cn("figure text-[15px] transition-colors duration-200", on ? "text-canary" : "text-ink-2")}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
