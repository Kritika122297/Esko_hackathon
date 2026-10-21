import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, ApiError } from "@/lib/api";
import { ChatAction, ChatCitation, ChatScope, SessionView, SourceRef } from "@/lib/types";

interface Highlight {
  label: string;
  sources: SourceRef[];
}

/** Result of a load: "stale" means a newer load or action superseded it, so its response was ignored. */
export type LoadResult = "ok" | "failed" | "stale";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  scope?: ChatScope;
  citations?: ChatCitation[];
  suggestions?: string[];
  actions?: ChatAction[];
}

interface BriefStore {
  sessionId: string | null;
  view: SessionView | null;
  highlight: Highlight | null;
  busy: string | null;
  busySince: number | null;
  notice: string | null;
  error: string | null;
  errorDetail: unknown;
  /** HTTP status of the last failed request (0 when the backend could not be reached). */
  errorStatus: number | null;
  /** Set when opening a brief failed for a reason other than "not found", so pages can offer a retry. */
  loadError: { id: string; message: string } | null;

  chatOpen: boolean;
  chats: Record<string, ChatMessage[]>;
  setChatOpen: (open: boolean) => void;
  addChat: (sid: string, m: ChatMessage) => void;
  setChat: (sid: string, messages: ChatMessage[]) => void;

  setHighlight: (h: Highlight | null) => void;
  clearError: () => void;
  clearNotice: () => void;
  load: (sid?: string) => Promise<LoadResult>;
  run: (label: string, fn: (sid: string) => Promise<SessionView>, done?: string) => Promise<boolean>;
  start: (fn: () => Promise<SessionView>, label: string) => Promise<boolean>;
  reset: () => void;
}

// Every response that replaces the view bumps this counter; a load whose number is no longer current is stale.
let viewSeq = 0;
// One mutating action (run/start) at a time; a second call while one is in flight is refused.
let inFlight = false;

const CLEAR_ERROR = { error: null, errorDetail: null, errorStatus: null } as const;

export const useBriefStore = create<BriefStore>()(
  persist(
    (set, get) => ({
      sessionId: null,
      view: null,
      highlight: null,
      busy: null,
      busySince: null,
      notice: null,
      error: null,
      errorDetail: null,
      errorStatus: null,
      loadError: null,

      chatOpen: false,
      chats: {},
      setChatOpen: (chatOpen) => set({ chatOpen }),
      addChat: (sid, m) => set((st) => ({ chats: { ...st.chats, [sid]: [...(st.chats[sid] ?? []), m] } })),
      setChat: (sid, messages) => set((st) => ({ chats: { ...st.chats, [sid]: messages } })),

      setHighlight: (highlight) => set({ highlight }),
      clearError: () => set({ ...CLEAR_ERROR }),
      clearNotice: () => set({ notice: null }),

      load: async (sid) => {
        const id = sid ?? get().sessionId;
        if (!id) return "failed";
        const seq = ++viewSeq;
        // Switching to another brief drops the previous brief's artwork highlight.
        if (id !== get().view?.state.session_id) set({ highlight: null });
        // A running action keeps its own busy label; the load does not take it over.
        const ownsBusy = !inFlight;
        set({ ...CLEAR_ERROR, loadError: null, ...(ownsBusy ? { busy: "Loading brief", busySince: Date.now() } : {}) });
        const idle = () => (ownsBusy && !inFlight ? { busy: null, busySince: null } : {});
        try {
          const view = await api.get(id);
          if (seq !== viewSeq) return "stale";
          set({ view, sessionId: id, ...idle() });
          return "ok";
        } catch (e) {
          if (seq !== viewSeq) return "stale";
          const err = e as ApiError;
          const gone = err.status === 404;
          const st = get();
          set({
            ...idle(),
            error: err.message,
            errorDetail: err.detail,
            errorStatus: err.status ?? null,
            // A brief that no longer exists is forgotten (pages then show "No brief open"); other failures can be retried.
            ...(gone
              ? { sessionId: st.sessionId === id ? null : st.sessionId, view: st.view?.state.session_id === id ? null : st.view }
              : { loadError: { id, message: err.message } }),
          });
          return "failed";
        }
      },

      start: async (fn, label) => {
        if (inFlight) return false;
        inFlight = true;
        set({ busy: label, busySince: Date.now(), ...CLEAR_ERROR, loadError: null, highlight: null, notice: null });
        try {
          const view = await fn();
          viewSeq += 1; // a load still in flight must not replace the new brief
          set({ view, sessionId: view.state.session_id, busy: null, busySince: null, notice: "Brief ready" });
          return true;
        } catch (e) {
          const err = e as ApiError;
          set({ busy: null, busySince: null, error: err.message, errorDetail: err.detail, errorStatus: err.status ?? null });
          return false;
        } finally {
          inFlight = false;
        }
      },

      run: async (label, fn, done = "Saved and re-checked") => {
        const sid = get().sessionId;
        if (!sid || inFlight) return false;
        inFlight = true;
        set({ busy: label, busySince: Date.now(), ...CLEAR_ERROR, notice: null });
        try {
          const view = await fn(sid);
          viewSeq += 1; // a load still in flight holds an older view
          set({ view, busy: null, busySince: null, notice: done });
          return true;
        } catch (e) {
          const err = e as ApiError;
          set({ busy: null, busySince: null, error: err.message, errorDetail: err.detail, errorStatus: err.status ?? null });
          return false;
        } finally {
          inFlight = false;
        }
      },

      reset: () => {
        viewSeq += 1;
        set({ sessionId: null, view: null, highlight: null, ...CLEAR_ERROR, loadError: null, busy: null, busySince: null, notice: null, chatOpen: false });
      },
    }),
    { name: "briefforge-session", partialize: (s) => ({ sessionId: s.sessionId }) }
  )
);
