"use client";

import { useEffect, useState } from "react";
import { useBriefStore } from "@/store/briefStore";

/**
 * Loads the persisted session once on mount; pages render nothing until it is known.
 * A `?session=<id>` query parameter opens that session directly (shareable demo links).
 * While `view` is null, pages render <SessionPending/>, which shows the load failure and a retry when loading failed.
 */
export function useSession() {
  const { sessionId, view, load } = useBriefStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("session");
    if (fromUrl && /^[a-f0-9]{12}$/.test(fromUrl) && fromUrl !== useBriefStore.getState().sessionId) {
      load(fromUrl).finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, [load]);

  useEffect(() => {
    if (ready && sessionId && (!view || view.state.session_id !== sessionId)) {
      load(sessionId);
    }
  }, [ready, sessionId, view, load]);

  return { ready, sessionId: ready ? sessionId : null, view: ready ? view : null };
}
