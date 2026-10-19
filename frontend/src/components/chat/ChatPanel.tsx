"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, Loader2, MessageSquareText, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { ChatCitation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

const STARTERS = [
  "What is still blocking the brief?",
  "Summarize this brief",
  "Which values differ between the files?",
  "What does R&D need to answer?",
];

const HIDDEN_ON = ["/upload", "/projects"];

/** The "Ask" button for the context bar and the mobile corner. */
export function AskButton({ className }: { className?: string }) {
  const { setChatOpen, chatOpen } = useBriefStore();
  return (
    <button
      onClick={() => setChatOpen(!chatOpen)}
      aria-expanded={chatOpen}
      aria-controls="brief-chat"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded border border-ink bg-stock px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-ground",
        className
      )}
    >
      <MessageSquareText className="h-4 w-4" /> Ask about this brief
    </button>
  );
}

export function ChatPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionId, view, chatOpen, setChatOpen, chats, addChat, setChat, setHighlight } = useBriefStore();
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLOListElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messages = sessionId ? chats[sessionId] ?? [] : [];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);
  useEffect(() => {
    if (chatOpen) inputRef.current?.focus();
  }, [chatOpen]);
  // The conversation is saved with the brief: load it when the brief changes or the panel opens.
  useEffect(() => {
    if (!sessionId || !chatOpen) return;
    api
      .chatHistory(sessionId)
      .then((h) => setChat(sessionId, h.map((m) => ({ role: m.role, text: m.text, citations: m.citations, suggestions: m.suggestions }))))
      .catch(() => undefined);
  }, [sessionId, chatOpen, setChat]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setChatOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setChatOpen]);

  if (!sessionId || !view || HIDDEN_ON.includes(pathname)) return null;

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    addChat(sessionId, { role: "user", text: q });
    setDraft("");
    setThinking(true);
    try {
      const a = await api.chat(sessionId, q);
      addChat(sessionId, { role: "assistant", text: a.answer, citations: a.citations, suggestions: a.suggestions });
    } catch (e) {
      addChat(sessionId, { role: "assistant", text: `Could not answer: ${(e as Error).message}` });
    } finally {
      setThinking(false);
    }
  };

  const follow = (c: ChatCitation) => {
    if (c.kind === "field") {
      const f = view.state.fields.find((x) => x.key === c.key);
      const located = f ? [...f.sources, ...f.candidates.map((x) => x.source)].filter((x) => x.bbox) : [];
      if (f && located.length) setHighlight({ label: f.label, sources: located });
      if (pathname !== "/review") router.push("/review");
    } else {
      const i = view.state.issues.find((x) => x.id === c.key);
      const located = i ? i.evidence.filter((x) => x.bbox) : [];
      if (i && located.length) setHighlight({ label: i.title, sources: located });
      if (pathname !== "/analysis" && pathname !== "/review") router.push("/analysis");
    }
    if (window.innerWidth < 1024) setChatOpen(false);
  };

  return (
    <>
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="no-print fixed bottom-5 left-5 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-white shadow-lift lg:hidden"
          aria-controls="brief-chat"
        >
          <MessageSquareText className="h-4 w-4" /> Ask
        </button>
      )}
      <aside
        id="brief-chat"
        aria-label="Ask about this brief"
        aria-hidden={!chatOpen}
        className={cn(
          "no-print fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-line bg-stock shadow-lift transition-transform duration-300 ease-out",
          chatOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-ink">Ask about this brief</h2>
            <p className="truncate text-xs text-ink-muted">Answers come only from {view.state.product_name}&apos;s files, findings and decisions.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={async () => {
                  if (!confirm("Clear this brief's conversation?")) return;
                  await api.clearChat(sessionId);
                  setChat(sessionId, []);
                }}
                className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-semibold text-ink-muted hover:bg-ink/5 hover:text-ink"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <button onClick={() => setChatOpen(false)} className="grid h-8 w-8 place-items-center rounded hover:bg-ink/5" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <ol ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 && (
            <li className="space-y-2">
              <p className="text-[13px] text-ink-muted">Try one of these, or ask about any value, claim or finding.</p>
              <div className="flex flex-col items-start gap-1.5">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded border border-line bg-ground px-2.5 py-1.5 text-left text-[13px] text-ink hover:border-ink">
                    {s}
                  </button>
                ))}
              </div>
            </li>
          )}
          {messages.map((m, i) => (
            <li key={i} className={cn("anim-rise", m.role === "user" ? "flex justify-end" : "")}>
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded bg-ink px-3 py-2 text-[13px] leading-relaxed text-white">{m.text}</p>
              ) : (
                <div className="max-w-[95%] space-y-2">
                  <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{m.text}</p>
                  {m.citations && m.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.citations.map((c) => (
                        <button
                          key={`${c.kind}-${c.key}`}
                          onClick={() => follow(c)}
                          className="max-w-full truncate rounded border border-line-strong bg-stock px-2 py-0.5 text-left text-xs font-semibold text-rail hover:border-ink"
                          title={c.kind === "field" ? "Open this field in the workbench" : "Open this finding"}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="flex flex-col items-start gap-1.5">
                      {m.suggestions.map((s) => (
                        <button key={s} onClick={() => ask(s)} className="rounded border border-line bg-ground px-2.5 py-1.5 text-left text-[13px] text-ink hover:border-ink">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
          {thinking && (
            <li className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Looking through the brief…
            </li>
          )}
        </ol>

        <form
          className="border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            Your question
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="chat-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(draft);
                }
              }}
              rows={2}
              maxLength={1000}
              placeholder="e.g. Why is the vegan claim flagged?"
              className="min-h-[44px] flex-1 resize-none rounded border border-line-strong bg-stock px-3 py-2 text-sm focus:border-ink"
            />
            <button
              type="submit"
              disabled={!draft.trim() || thinking}
              className="grid h-11 w-11 shrink-0 place-items-center rounded bg-rail text-white hover:bg-rail-2 disabled:opacity-50"
              aria-label="Send question"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
