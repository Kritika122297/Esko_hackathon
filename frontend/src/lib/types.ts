// Mirror the backend Pydantic models

export type Confidence = "high" | "medium" | "low";
export type FieldStatus = "confirmed" | "flagged" | "missing" | "conflicting";
export type IssueSeverity = "critical" | "warning" | "info";
export type IssueCategory = "math_error" | "conflict" | "missing" | "rule_violation" | "assumption";
export type BriefStatus = "draft" | "in_review" | "finalized";

export interface BriefField {
  field_name: string;
  value: any;
  source: string;
  confidence: Confidence;
  status: FieldStatus;
  issues: string[];
  user_override?: any;
}

export interface BriefSection {
  section_name: string;
  fields: BriefField[];
}

export interface PackagingBrief {
  session_id: string;
  product_name: string;
  created_at: string;
  status: BriefStatus;
  sections: BriefSection[];
  open_questions: string[];
  issues_summary: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface Issue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  field_name?: string;
  source: string;
  suggestion?: string;
}

export interface ValidationResult {
  issues: Issue[];
  passed: boolean;
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface SmartQuestion {
  id: string;
  question: string;
  context: string;
  suggested_answer?: string;
  priority: "must_answer" | "nice_to_have";
  related_field: string;
}

export interface UploadResponse {
  session_id: string;
  files_processed: number;
  extraction_summary: {
    total_text_blocks: number;
    total_tables: number;
    total_images: number;
    files: Array<{ name: string; type: string; status: string; size?: number }>;
  };
}

export interface ExtractionData {
  session_id: string;
  texts: Array<{
    text: string;
    source_file: string;
    location: string;
    confidence: number;
  }>;
  tables: Array<{
    source_file: string;
    title?: string;
    headers: string[];
    rows: Array<Record<string, any> | any[]>;
  }>;
  metadata: Record<string, any>;
}

// Workflow steps
export type WorkflowStep = "upload" | "analysis" | "questions" | "review" | "export";

export interface WorkflowState {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  sessionId: string | null;
}
