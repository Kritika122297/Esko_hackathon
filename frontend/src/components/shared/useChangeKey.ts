"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A counter that increases only when `signature` changes after the first render.
 * Used as a React key so a stamp or a re-written value animates when a decision lands, never on first paint.
 */
export function useChangeKey(signature: string) {
  const first = useRef(true);
  const prev = useRef(signature);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (prev.current !== signature) {
      prev.current = signature;
      setN((x) => x + 1);
    }
  }, [signature]);
  return n;
}
