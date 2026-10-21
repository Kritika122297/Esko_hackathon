// Mirrors backend/app/models (Pydantic). Keep in sync.

export type FieldStatus = "confirmed" | "needs_review" | "missing";
export type Severity = "blocking" | "warning" | "info";
export type IssueKind = "definite" | "likely" | "needs_human";
export type DesignAction = "keep" | "change" | "add" | "remove" | "unknown";
export type CaseType = "update" | "new_market" | "new_product";

export interface SourceRef {
  file: string;
  kind: "pdf" | "excel" | "word" | "text" | "user" | "derived" | "ai";
  snippet: string;
  page?: number | null;
  panel?: string | null;
  bbox?: number[] | null;
  sheet?: string | null;
  cell?: string | null;
  note?: string | null;
  flagged: boolean;
}

export interface Candidate {
  value: string;
  source: SourceRef;
}

export type Origin = "human" | "rule" | "ai" | "source";
export type Absence = "not_provided" | "not_detected" | "not_applicable";

export interface FieldChange {
  at: string;
  by: string;
  origin: Origin;
  old?: string | null;
  new?: string | null;
  reason?: string | null;
}

export interface BriefField {
  key: string;
  label: string;
  section: string;
  value: string | null;
  status: FieldStatus;
  confidence: number;
  sources: SourceRef[];
  candidates: Candidate[];
  notes: string[];
  mandatory: boolean;
  on_artwork: boolean;
  user_confirmed: boolean;
  not_applicable: boolean;
  absence?: Absence | null;
  history: FieldChange[];
}

export interface Issue {
  id: string;
  check: string;
  severity: Severity;
  kind: IssueKind;
  category: string;
  title: string;
  description: string;
  suggestion?: string | null;
  fields: string[];
  evidence: SourceRef[];
  owner: string;
  design_action?: DesignAction | null;
  resolution: "data" | "design";
  detected_by: "code" | "ai";
  clauses?: string[];
  state: "open" | "acknowledged";
  acknowledgement?: string | null;
}

export interface PassedCheck {
  check: string;
  title: string;
  detail: string;
  fields: string[];
}

export interface QuestionOption {
  id: string;
  label: string;
  updates: Record<string, string>;
  acknowledge: boolean;
  recommended: boolean;
}

export interface Question {
  id: string;
  issue_ids: string[];
  fields: string[];
  question: string;
  why: string;
  owner: string;
  priority: "must_answer" | "should_answer";
  options: QuestionOption[];
  custom_field?: string | null;
  ai_worded?: boolean;
  original_question?: string | null;
}

export interface ChangeLogEntry {
  at: string;
  by: string;
  action: string;
  origin?: Origin;
  field?: string | null;
  issue?: string | null;
  old?: string | null;
  new?: string | null;
  note?: string | null;
}

export interface Readiness {
  score: number;
  ready: boolean;
  fields_total: number;
  fields_confirmed: number;
  fields_needs_review: number;
  fields_missing: number;
  blocking_open: number;
  warnings_open: number;
  acknowledged: number;
  questions_open: number;
  headline: string;
}

export interface BriefState {
  session_id: string;
  created_at: string;
  updated_at: string;
  case: CaseType;
  market: string;
  status: "draft" | "finalized";
  product_name: string;
  files: { name: string; kind: string; size: number; pages?: number | null }[];
  fields: BriefField[];
  issues: Issue[];
  passed_checks: PassedCheck[];
  questions: Question[];
  acknowledgements: Record<string, string>;
  change_log: ChangeLogEntry[];
  extraction_notes: string[];
  ai: { provider: string; model?: string | null; enabled: boolean; used_for: string[]; notes: string[] };
  readiness: Readiness | null;
}

export interface PageView {
  file: string;
  page: number;
  width: number;
  height: number;
  image: string;
  url: string;
}

export interface Panel {
  id: string;
  label: string;
  file: string;
  page: number;
  bbox: number[];
  is_main: boolean;
}

export interface SessionView {
  state: BriefState;
  pages: PageView[];
  panels: Panel[];
}

export interface DesignItem {
  item: string;
  action: DesignAction;
  instruction: string;
  panel?: string | null;
  current?: string | null;
  new?: string | null;
  owner?: string | null;
  fields: string[];
  issue_ids: string[];
}

export interface ProofRow {
  field: string;
  label: string;
  value: string | null;
  status: FieldStatus;
  sources: string[];
}

export interface DesignerBrief {
  product: string;
  market: string;
  case: string;
  status: string;
  updated_at: string;
  readiness: Readiness | null;
  summary: string[];
  items: DesignItem[];
  panels: { panel: string; label: string; bbox?: number[] | null; items: DesignItem[] }[];
  final_copy: ProofRow[];
  nutrition: { label: string; amount: string | null; dv: string | null; status: string }[];
  open_questions: { question: string; owner: string; detail: string; issue_id: string }[];
  proof: ProofRow[];
  change_log: ChangeLogEntry[];
}

export interface ImpactPreview {
  field: string;
  old: string | null;
  new: string;
  resolved: { id: string; title: string; severity: Severity }[];
  introduced: { id: string; title: string; severity: Severity }[];
  status_changes: { key: string; label: string; before: string; after: string }[];
  artwork_locations: SourceRef[];
  sheet_locations: SourceRef[];
  readiness_before: number;
  readiness_after: number;
  blocking_before: number;
  blocking_after: number;
  approvals_needed: string[];
}


export interface ProjectSummary {
  session_id: string;
  product_name: string;
  market: string;
  case: CaseType;
  status: "draft" | "finalized";
  created_at: string;
  updated_at: string;
  files: string[];
  readiness: number | null;
  blocking_open: number | null;
  questions_open: number | null;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatCitation {
  kind: "field" | "issue";
  key: string;
  label: string;
}

export interface ChatAnswer {
  answer: string;
  citations: ChatCitation[];
  suggestions: string[];
}

export interface ChatMessageOut {
  role: "user" | "assistant";
  text: string;
  at: string;
  citations: ChatCitation[];
  suggestions: string[];
}

export interface RulePack {
  standard: string;
  name: string;
  status: string;
  version?: string;
  clauses: number;
}

export interface RulesSummary {
  packs: RulePack[];
  market_rules: boolean;
  all_verified: boolean;
}

export interface ChecklistField {
  key: string;
  label: string;
  section: string;
  owner: string;
  severity: string;
  clauses: string[];
  or?: string[];
}

export interface StandardsOptions {
  markets: { code: string; label: string }[];
  categories: { id: string; label: string; has_rules: boolean }[];
  standards: { standard: string; name: string; status: string; markets: { code: string; label: string }[]; categories: string[]; clauses: number }[];
}

export interface RulebookRule {
  id: string;
  field: string;
  label: string;
  severity: string;
  owner: string;
  quote: string;
  method: "keyword" | "ai";
}

export interface RulebookProposal {
  filename: string;
  characters: number;
  rules: RulebookRule[];
  ai_used: boolean;
}
