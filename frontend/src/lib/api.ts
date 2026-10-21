import {
  CaseType, ChatAnswer, ChatMessageOut, ChecklistField, DesignerBrief, ImpactPreview, ProjectSummary, RulesSummary, SessionView,
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, init);
  } catch {
    throw new ApiError(0, "Cannot reach the BriefForge backend. Is it running on port 8000?");
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
  return (await res.json()) as T;
}

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
           company?: { filename: string; rules: object[] }) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("case", caseType);
    form.append("market", market);
    form.append("category", category);
    form.append("standards", standards.join(","));
    if (company && company.rules.length) {
      form.append("company_rules", JSON.stringify(company.rules));
      form.append("company_file", company.filename);
    }
    form.append("allow_duplicate", String(allowDuplicate));
    return request<SessionView>("/sessions", { method: "POST", body: form });
  },

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

  answer: (sid: string, qid: string, body: { option_id?: string; custom_value?: string; note?: string }) =>
    request<SessionView>(`/sessions/${sid}/questions/${encodeURIComponent(qid)}/answer`, json(body)),

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
  clearChat: async (sid: string) => {
    await fetch(`${API}/sessions/${sid}/chat`, { method: "DELETE" });
  },

  designerBrief: (sid: string) => request<DesignerBrief>(`/sessions/${sid}/designer-brief`),
  exportUrl: (sid: string, fmt: "docx" | "pdf") => `${API}/sessions/${sid}/export/${fmt}`,
};
