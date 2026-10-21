"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, Check, Loader2, MessageSquareText, Trash2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Flag } from "@/components/shared/badges";
import { api } from "@/lib/api";
import { ChatAction, ChatCitation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBriefStore } from "@/store/briefStore";

const STARTERS = [
  "What is still blocking the brief?",
  "Summarize this brief",
  "Accept the suggested answers for Legal",
  "Which values differ between the files?",
  "What makes a good packaging design brief?",
];

/** A change the assistant prepared: what it does, what the preview says it would fix, and Apply / Cancel. */
function ActionCard({
  action,
  disabled,
  onApply,
  onCancel,
}: {
  action: ChatAction;
  disabled: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const imp = action.impact;
  const proposed = action.status === "proposed";
  return (
    <div className={cn("rounded border bg-stock p-3", proposed ? "border-ink" : "border-line")}>
      <div className="flex items-start gap-2">
        <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rail" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{action.label}</p>
          {action.detail && <p className="mt-0.5 text-xs leading-snug text-ink-muted [overflow-wrap:anywhere]">{action.detail}</p>}
          {imp && proposed && (
            <ul className="mt-1.5 space-y-0.5 text-xs leading-snug">
              {imp.resolved.length > 0 && (
                <li className="text-ok-deep">
                  <b className="font-semibold">Fixes {imp.resolved.length}:</b> {imp.resolved.slice(0, 3).join("; ")}
                  {imp.resolved.length > 3 && ` and ${imp.resolved.length - 3} more`}
                </li>
              )}
              {imp.introduced.length > 0 && (
                <li className="text-stop-deep">
                  <b className="font-semibold">New issue{imp.introduced.length === 1 ? "" : "s"}:</b> {imp.introduced.slice(0, 3).join("; ")}
                </li>
              )}
              {!imp.resolved.length && !imp.introduced.length && <li className="text-ink-muted">Fixes no finding by itself.</li>}
              <li className="meta text-ink-faint">
                Readiness {imp.readiness_before}% → {imp.readiness_after}% · Blocking {imp.blocking_before} → {imp.blocking_after}
              </li>
            </ul>
          )}
        </div>
      </div>
      {proposed ? (
        <div className="mt-2.5 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={disabled}>
            Cancel
          </Button>
          <Button size="sm" onClick={onApply} disabled={disabled}>
            <Check className="h-3.5 w-3.5" /> Apply
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Flag tone={action.status === "applied" ? "ok" : action.status === "failed" ? "stop" : "muted"} side="right" className="-ml-3">
            {action.status === "applied" ? "Applied" : action.status === "failed" ? "Not applied" : "Cancelled"}
          </Flag>
          {action.result && action.status === "failed" && <span className="text-xs text-ink-muted">{action.result}</span>}
        </div>
      )}
    </div>
  );
}

const HIDDEN_ON = ["/upload", "/projects"];
// Below the lg breakpoint the panel covers the page, so it behaves as a modal dialog.
const SMALL = "(max-width: 1023.98px)";

function useSmallScreen() {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(SMALL);
    const update = () => setSmall(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return small;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
      <MessageSquareText className="h-4 w-4" /> Ask
    </button>
  );
}

export function ChatPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionId, view, chatOpen, setChatOpen, chats, addChat, setChat, setHighlight, run, busy } = useBriefStore();
  const finalized = view?.state.status === "finalized";
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const thinkingRef = useRef(false);
  const listRef = useRef<HTMLOListElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const small = useSmallScreen();
  const messages = sessionId ? chats[sessionId] ?? [] : [];
  const shown = !!sessionId && !!view && !HIDDEN_ON.includes(pathname);
  const modal = chatOpen && small;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  // A closed panel stays in the DOM for its slide animation; `inert` removes it from the tab order and the accessibility tree.
  // Declared before the focus effect so the panel is no longer inert when focus moves into it.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (chatOpen) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [chatOpen, shown]);

  // Opening moves focus into the panel; closing returns it to whatever opened it, or to the Ask button.
  useEffect(() => {
    if (!shown) {
      // Hidden on this route: remember the state without moving focus, so returning to a page is not a transition.
      wasOpen.current = chatOpen;
      return;
    }
    if (chatOpen && !wasOpen.current) {
      const active = document.activeElement;
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
      inputRef.current?.focus();
    }
    if (!chatOpen && wasOpen.current) {
      const active = document.activeElement;
      const focusWasInside = !active || active === document.body || !!panelRef.current?.contains(active);
      if (focusWasInside) {
        const prev = returnTo.current;
        const back = prev && prev.isConnected && prev.offsetParent !== null ? prev : fabRef.current;
        back?.focus();
      }
      returnTo.current = null;
    }
    wasOpen.current = chatOpen;
  }, [chatOpen, shown]);

  // The conversation is saved with the brief: load it when the brief changes or the panel opens.
  // A question still waiting for its answer exists only here, so the saved history must not replace it.
  useEffect(() => {
    if (!sessionId || !chatOpen) return;
    let cancelled = false;
    api
      .chatHistory(sessionId)
      .then((h) => {
        if (cancelled || thinkingRef.current) return;
        const local = useBriefStore.getState().chats[sessionId] ?? [];
        if (h.length < local.length) return; // turns not saved on the server yet (e.g. a failed answer) are kept
        setChat(
          sessionId,
          h.map((m) => ({ role: m.role, text: m.text, scope: m.scope, citations: m.citations, suggestions: m.suggestions, actions: m.actions }))
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionId, chatOpen, setChat]);

  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // A modal dialog opened from the page (e.g. Add files) handles its own Escape.
        if (document.querySelector("dialog[open]")) return;
        setChatOpen(false);
        return;
      }
      // As a modal on small screens, Tab cycles within the panel.
      const panel = panelRef.current;
      if (e.key !== "Tab" || !modal || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, modal, setChatOpen]);

  if (!shown || !sessionId || !view) return null;

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    addChat(sessionId, { role: "user", text: q });
    setDraft("");
    thinkingRef.current = true;
    setThinking(true);
    try {
      const a = await api.chat(sessionId, q);
      addChat(sessionId, { role: "assistant", text: a.answer, scope: a.scope, citations: a.citations, suggestions: a.suggestions, actions: a.actions });
    } catch (e) {
      addChat(sessionId, { role: "assistant", text: `Could not answer: ${(e as Error).message}` });
    } finally {
      thinkingRef.current = false;
      setThinking(false);
    }
  };

  // Replaces one action in the conversation with its new state (applied, cancelled or failed).
  const updateAction = (next: ChatAction) => {
    const list = useBriefStore.getState().chats[sessionId] ?? [];
    setChat(sessionId, list.map((m) => (m.actions?.some((a) => a.id === next.id) ? { ...m, actions: m.actions.map((a) => (a.id === next.id ? next : a)) } : m)));
  };

  /** Applies a prepared change through the store, so the brief on screen updates and the change is re-checked. */
  const applyAction = async (a: ChatAction): Promise<boolean> => {
    let result: ChatAction | null = null;
    const ok = await run(
      `Applying: ${a.label}`,
      async (sid) => {
        const r = await api.applyChatAction(sid, a.id);
        result = r.action;
        if (!r.view) throw new Error(r.action.result ?? "The change could not be applied.");
        return r.view;
      },
      "Applied from the assistant · checks re-run"
    );
    if (result) updateAction(result);
    return ok;
  };
  const applyAll = async (actions: ChatAction[]) => {
    for (const a of actions.filter((x) => x.status === "proposed")) {
      if (!(await applyAction(a))) break; // stop at the first one that does not fit any more
    }
  };
  const cancelAction = async (a: ChatAction) => {
    try {
      updateAction((await api.cancelChatAction(sessionId, a.id)).action);
    } catch {
      /* the card stays as it is; the next history load shows the saved state */
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
          ref={fabRef}
          onClick={() => setChatOpen(true)}
          aria-expanded={false}
          className="no-print fixed bottom-5 left-5 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-white shadow-lift lg:hidden"
          aria-controls="brief-chat"
        >
          <MessageSquareText className="h-4 w-4" /> Ask
        </button>
      )}
      {modal && <div aria-hidden className="no-print fixed inset-0 z-50 bg-ink/40 lg:hidden" onClick={() => setChatOpen(false)} />}
      <aside
        ref={panelRef}
        id="brief-chat"
        aria-labelledby="brief-chat-h"
        role={modal ? "dialog" : "complementary"}
        aria-modal={modal || undefined}
        className={cn(
          "no-print fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-line bg-stock shadow-lift transition-transform duration-300 ease-out",
          chatOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 id="brief-chat-h" className="text-[16px] font-bold text-ink">
              Assistant
            </h2>
            <p className="text-xs text-ink-muted">
              Ask anything. Facts about {view.state.product_name} come only from its files and decisions.
            </p>
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
            <button onClick={() => setChatOpen(false)} className="grid h-8 w-8 place-items-center rounded hover:bg-ink/5" aria-label="Close the assistant">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <ol ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 && (
            <li className="space-y-2">
              <p className="text-[13px] text-ink-muted">
                Ask about this brief, labelling and packaging in general, or anything else. Some ideas:
              </p>
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
                  {m.scope === "general" && (
                    <p className="meta text-ink-faint" title="This answer uses general knowledge, not this brief's files. Confirm regulatory points with Legal.">
                      General knowledge · not from this brief
                    </p>
                  )}
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
                  {m.actions && m.actions.length > 0 && (
                    <div className="space-y-1.5" aria-label="Changes prepared by the assistant">
                      {m.actions.map((a) => (
                        <ActionCard
                          key={a.id}
                          action={a}
                          disabled={!!busy || finalized}
                          onApply={() => applyAction(a)}
                          onCancel={() => cancelAction(a)}
                        />
                      ))}
                      {m.actions.filter((a) => a.status === "proposed").length > 1 && (
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" disabled={!!busy || finalized} onClick={() => applyAll(m.actions ?? [])}>
                            <Check className="h-3.5 w-3.5" /> Apply all {m.actions.filter((a) => a.status === "proposed").length}
                          </Button>
                        </div>
                      )}
                      <p className="text-[11px] text-ink-faint">Checked by code against the brief. Each change is logged and can be undone.</p>
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
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
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
              placeholder="Ask anything, or ask for a change: set storage to Keep dry"
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
