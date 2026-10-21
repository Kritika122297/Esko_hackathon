"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Case-insensitive match: every word of the query must appear somewhere in the given parts. */
export function matchesQuery(query: string, ...parts: (string | null | undefined)[]) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = parts.filter(Boolean).join(" \u0000 ").toLowerCase();
  return terms.every((t) => hay.includes(t));
}

/**
 * Search input with a visible magnifier, a clear button and a screen-reader result count.
 * Escape clears the query. `count` is announced politely while a query is typed.
 */
export function SearchBox({
  id,
  label,
  value,
  onChange,
  placeholder,
  count,
  noun = ["result", "results"],
  size = "md",
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  count?: number;
  noun?: [string, string];
  size?: "sm" | "md";
  className?: string;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const small = size === "sm";
  const active = value.trim().length > 0;

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden
        className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-faint", small ? "left-2 h-3.5 w-3.5" : "left-3 h-4 w-4")}
      />
      <input
        ref={input}
        id={id}
        type="search"
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            // Clear the query only; do not also close a panel or dialog around the field.
            e.preventDefault();
            e.stopPropagation();
            onChange("");
          }
        }}
        placeholder={placeholder}
        className={cn(
          "w-full rounded border border-line-strong bg-stock text-ink focus:border-ink [&::-webkit-search-cancel-button]:hidden",
          small ? "h-8 pl-7 pr-8 text-xs" : "h-10 pl-9 pr-10 text-sm"
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          aria-label={`Clear ${label.toLowerCase()}`}
          className={cn(
            "absolute top-1/2 grid -translate-y-1/2 place-items-center rounded text-ink-muted hover:bg-ink/5 hover:text-ink",
            small ? "right-1 h-6 w-6" : "right-1.5 h-7 w-7"
          )}
        >
          <X className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </button>
      )}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {active && count !== undefined ? `${count} ${count === 1 ? noun[0] : noun[1]}` : ""}
      </span>
    </div>
  );
}
