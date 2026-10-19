import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, ApiError } from "@/lib/api";
import { ChatCitation, SessionView, SourceRef } from "@/lib/types";

interface Highlight {
  label: string;
  sources: SourceRef[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  citations?: ChatCitation[];
  suggestions?: string[];
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

  chatOpen: boolean;
  chats: Record<string, ChatMessage[]>;
  setChatOpen: (open: boolean) => void;
  addChat: (sid: string, m: ChatMessage) => void;
  setChat: (sid: string, messages: ChatMessage[]) => void;

  setHighlight: (h: Highlight | null) => void;
  clearError: () => void;
  clearNotice: () => void;
  load: (sid?: string) => Promise<void>;
  run: (label: string, fn: (sid: string) => Promise<SessionView>, done?: string) => Promise<boolean>;
  start: (fn: () => Promise<SessionView>, label: string) => Promise<boolean>;
  reset: () => void;
}

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

      chatOpen: false,
      chats: {},
      setChatOpen: (chatOpen) => set({ chatOpen }),
      addChat: (sid, m) => set((st) => ({ chats: { ...st.chats, [sid]: [...(st.chats[sid] ?? []), m] } })),
      setChat: (sid, messages) => set((st) => ({ chats: { ...st.chats, [sid]: messages } })),

      setHighlight: (highlight) => set({ highlight }),
      clearError: () => set({ error: null, errorDetail: null }),
      clearNotice: () => set({ notice: null }),

      load: async (sid) => {
        const id = sid ?? get().sessionId;
        if (!id) return;
        // Switching to another brief drops the previous brief's artwork highlight.
        if (id !== get().view?.state.session_id) set({ highlight: null });
        set({ busy: "Loading brief", busySince: Date.now(), error: null });
        try {
          const view = await api.get(id);
          set({ view, sessionId: id, busy: null, busySince: null });
        } catch (e) {
          const err = e as ApiError;
          set({
            busy: null,
            busySince: null,
            error: err.message,
            ...(err.status === 404 ? { sessionId: null, view: null } : {}),
          });
        }
      },

      start: async (fn, label) => {
        set({ busy: label, busySince: Date.now(), error: null, highlight: null, notice: null });
        try {
          const view = await fn();
          set({ view, sessionId: view.state.session_id, busy: null, busySince: null, notice: "Brief ready" });
          return true;
        } catch (e) {
          const err = e as ApiError;
          set({ busy: null, busySince: null, error: err.message, errorDetail: err.detail });
          return false;
        }
      },

      run: async (label, fn, done = "Saved and re-checked") => {
        const sid = get().sessionId;
        if (!sid) return false;
        set({ busy: label, busySince: Date.now(), error: null, notice: null });
        try {
          const view = await fn(sid);
          set({ view, busy: null, busySince: null, notice: done });
          return true;
        } catch (e) {
          const err = e as ApiError;
          set({ busy: null, busySince: null, error: err.message, errorDetail: err.detail });
          return false;
        }
      },

      reset: () => set({ sessionId: null, view: null, highlight: null, error: null, busy: null, notice: null, chatOpen: false }),
    }),
    { name: "briefforge-session", partialize: (s) => ({ sessionId: s.sessionId }) }
  )
);
