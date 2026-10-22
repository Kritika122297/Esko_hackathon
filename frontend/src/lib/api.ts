import {
  Blueprint, CaseType, ChatActionResult, ChatAnswer, ChatMessageOut, MarketGap, PackAudit, PackFix, PackInspection,
  SimulatorReport, TraceView, ChecklistField, DesignerBrief, ImpactPreview, ProjectSummary, RulesSummary, SessionView,
  StandardsOptions, RulebookProposal,
} from "./types";

// Requests go to /api, which next.config.mjs proxies to the FastAPI backend.
const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, init);
  } catch {
    throw new ApiError(0, "Cannot reach the PackProofAI backend. Is it running on port 8000?");
  }
  if (!res.ok) {
    let detail: unknown = undefined;
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body?.detail;
      if (typeof detail === "string") message = detail;
      else if (detail && typeof detail === "object" && "message" in detail) message = String((detail as any).message);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, detail);
  }
  return res;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
  return (await res.json()) as T;
}

/** File name from a Content-Disposition header (RFC 5987 `filename*` first, then `filename`). */
function dispositionName(header: string | null): string | null {
  if (!header) return null;
  const star = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through to the plain name */
    }
  }
  const plain = header.match(/filename\s*=\s*("([^"]*)"|[^;]+)/);
  return plain ? (plain[2] ?? plain[1]).trim() : null;
}

export type AnswerBody = { kind?: "unknown" | "not_applicable"; option_id?: string; custom_value?: string; note?: string };

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  projects: () => request<ProjectSummary[]>("/sessions"),
  deleteProject: async (sid: string) => {
    const res = await fetch(`${API}/sessions/${sid}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new ApiError(res.status, "Could not delete the brief.");
  },

  standards: () => request<StandardsOptions>("/standards"),
  applicable: (market: string, category: string, standards: string[]) =>
    request<RulesSummary>(`/standards/applicable?${new URLSearchParams({ market, category, standards: standards.join(",") })}`),
  checklist: (market: string, category: string, standards: string[]) =>
    request<RulesSummary & { fields: ChecklistField[] }>(`/standards/checklist?${new URLSearchParams({ market, category, standards: standards.join(",") })}`),

  companyRulebook: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<RulebookProposal>("/standards/company-rulebook", { method: "POST", body: form });
  },

  upload: (files: File[], caseType: CaseType, market: string, allowDuplicate = false, category = "food", standards: string[] = [],
           company?: { filename: string; rules: object[] }, sourceMarket = "") => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("case", caseType);
    form.append("market", market);
    if (caseType === "new_market" && sourceMarket) form.append("source_market", sourceMarket);
    form.append("category", category);
    form.append("standards", standards.join(","));
    if (company && company.rules.length) {
      form.append("company_rules", JSON.stringify(company.rules));
      form.append("company_file", company.filename);
    }
    form.append("allow_duplicate", String(allowDuplicate));
    return request<SessionView>("/sessions", { method: "POST", body: form });
  },

  /** The flat plan with the layout rules that apply to this pack. */
  blueprint: (sid: string) => request<Blueprint>(`/sessions/${sid}/blueprint`),

  /** Would a studio accept this brief? Code checks score it; the AI lists what it still cannot tell. */
  runAgencySimulator: (sid: string) => request<SimulatorReport>(`/sessions/${sid}/agency-simulator`, json({})),

  /** What changes when this brief moves to another market (from the rule packs; nothing is created). */
  marketGap: (sid: string, target: string, category?: string) =>
    request<MarketGap>(`/sessions/${sid}/market-gap?target=${encodeURIComponent(target)}${category ? `&category=${encodeURIComponent(category)}` : ""}`),

  /** Starts building a brief in the background; follow it with the trace. Same form as `upload`. */
  uploadStart: (files: File[], caseType: CaseType, market: string, allowDuplicate = false, category = "food",
                standards: string[] = [], company?: { filename: string; rules: object[] }, sourceMarket = "") => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("case", caseType);
    form.append("market", market);
    if (caseType === "new_market" && sourceMarket) form.append("source_market", sourceMarket);
    form.append("category", category);
    form.append("standards", standards.join(","));
    if (company && company.rules.length) {
      form.append("company_rules", JSON.stringify(company.rules));
      form.append("company_file", company.filename);
    }
    form.append("allow_duplicate", String(allowDuplicate));
    form.append("background", "true");
    return request<{ session_id: string; status: string }>("/sessions", { method: "POST", body: form });
  },
  trace: (sid: string) => request<TraceView>(`/sessions/${sid}/trace`),
  traceStreamUrl: (sid: string) => `${API}/sessions/${sid}/trace/stream`,

  inspectField: (sid: string, key: string) => request<PackInspection>(`/sessions/${sid}/fields/${key}/inspect`),
  auditField: (sid: string, key: string) => request<PackAudit>(`/sessions/${sid}/fields/${key}/audit`, json({})),
  suggestFix: (sid: string, key: string) => request<PackFix>(`/sessions/${sid}/fields/${key}/suggest-fix`, json({})),
  applyFix: (sid: string, key: string, value: string, source: "code" | "ai", reason?: string) =>
    request<SessionView>(`/sessions/${sid}/fields/${key}/apply-fix`, json({ value, source, reason })),

  /** A new brief for another market from this brief's files, checked against that market's rules. */
  duplicateMarket: (sid: string, targetMarket: string, category?: string, productNameOverride?: string) =>
    request<SessionView>(`/sessions/${sid}/duplicate-market`,
      json({ target_market: targetMarket, category: category || null, product_name_override: productNameOverride || null })),

  addFiles: (sid: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return request<SessionView>(`/sessions/${sid}/files`, { method: "POST", body: form });
  },

  get: (sid: string) => request<SessionView>(`/sessions/${sid}`),

  undoField: (sid: string, key: string) => request<SessionView>(`/sessions/${sid}/fields/${key}/undo`, { method: "POST" }),

  markNotApplicable: (sid: string, key: string, reason: string) =>
    request<SessionView>(`/sessions/${sid}/fields/${key}/not-applicable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }),

  editField: (sid: string, key: string, value: string, reason?: string) =>
    request<SessionView>(`/sessions/${sid}/fields/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value, reason }),
    }),

  confirmField: (sid: string, key: string) =>
    request<SessionView>(`/sessions/${sid}/fields/${key}/confirm`, json({})),

  answer: (sid: string, qid: string, body: AnswerBody) =>
    request<SessionView>(`/sessions/${sid}/questions/${encodeURIComponent(qid)}/answer`, json(body)),

  changeAnswer: (sid: string, qid: string, body: AnswerBody) =>
    request<SessionView>(`/sessions/${sid}/questions/${encodeURIComponent(qid)}/change`, json(body)),

  acknowledge: (sid: string, iid: string, note: string) =>
    request<SessionView>(`/sessions/${sid}/issues/${encodeURIComponent(iid)}/acknowledge`, json({ note })),

  reopenIssue: (sid: string, iid: string) =>
    request<SessionView>(`/sessions/${sid}/issues/${encodeURIComponent(iid)}/reopen`, json({})),

  impact: (sid: string, field: string, value: string) =>
    request<ImpactPreview>(`/sessions/${sid}/impact`, json({ field, value })),

  finalize: (sid: string) => request<SessionView>(`/sessions/${sid}/finalize`, json({})),
  reopen: (sid: string) => request<SessionView>(`/sessions/${sid}/reopen`, json({})),

  chat: (sid: string, message: string) => request<ChatAnswer>(`/sessions/${sid}/chat`, json({ message })),
  chatHistory: (sid: string) => request<ChatMessageOut[]>(`/sessions/${sid}/chat`),
  applyChatAction: (sid: string, aid: string) =>
    request<ChatActionResult>(`/sessions/${sid}/chat/actions/${aid}/apply`, json({})),
  cancelChatAction: (sid: string, aid: string) =>
    request<ChatActionResult>(`/sessions/${sid}/chat/actions/${aid}/cancel`, json({})),
  clearChat: async (sid: string) => {
    await fetch(`${API}/sessions/${sid}/chat`, { method: "DELETE" });
  },

  designerBrief: (sid: string) => request<DesignerBrief>(`/sessions/${sid}/designer-brief`),
  exportUrl: (sid: string, fmt: "docx" | "pdf") => `${API}/sessions/${sid}/export/${fmt}`,
  /** Fetches an export as a file; errors arrive as ApiError instead of a page of raw JSON. */
  exportFile: async (sid: string, fmt: "docx" | "pdf") => {
    const res = await send(`/sessions/${sid}/export/${fmt}`);
    const blob = await res.blob();
    return { blob, filename: dispositionName(res.headers.get("Content-Disposition")) ?? `Design_Brief.${fmt}` };
  },
};
