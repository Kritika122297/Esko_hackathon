"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DIGITS = "0123456789";

/**
 * A number set in condensed figures whose digits roll to a new value, like a counter.
 * The first paint shows the value in place; only later changes roll. Screen readers get the plain value.
 */
export function RollingNumber({ value, className, suffix, label }: { value: number; className?: string; suffix?: React.ReactNode; label?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const text = String(Math.max(0, Math.round(value)));
  return (
    <span className={cn("figure inline-flex items-start", className)} aria-label={label ?? `${text}`} role="img">
      <span aria-hidden className="inline-flex overflow-hidden" style={{ height: "0.9em" }}>
        {text.split("").map((d, i) => (
          <span key={`${text.length}-${i}`} className="relative inline-block" style={{ height: "0.9em", width: "1ch" }}>
            <span
              className={cn("absolute inset-x-0 top-0 flex flex-col", ready && "transition-transform duration-[520ms] ease-out motion-reduce:transition-none")}
              style={{ transform: `translateY(-${DIGITS.indexOf(d) * 10}%)` }}
            >
              {DIGITS.split("").map((n) => (
                <span key={n} className="block text-center" style={{ height: "0.9em", lineHeight: "0.9em" }}>
                  {n}
                </span>
              ))}
            </span>
          </span>
        ))}
      </span>
      {suffix && <span aria-hidden>{suffix}</span>}
    </span>
  );
}
