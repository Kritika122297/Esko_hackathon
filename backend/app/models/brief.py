"""Brief state models: fields with proof, issues, questions and the change log."""

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.services.guidelines import Clause

FieldStatus = Literal["confirmed", "needs_review", "missing"]
Severity = Literal["blocking", "warning", "info"]
IssueKind = Literal["definite", "likely", "needs_human"]
IssueState = Literal["open", "acknowledged"]
DesignAction = Literal["keep", "change", "add", "remove", "unknown"]
Owner = Literal["R&D", "Legal", "Supply Chain", "Brand", "Agency"]
Case = Literal["update", "new_market", "new_product"]


class SourceRef(BaseModel):
    """Proof for a value: where exactly it was read."""

    file: str
    kind: Literal["pdf", "excel", "word", "text", "user", "derived", "ai"]
    snippet: str = ""
    page: Optional[int] = None
    panel: Optional[str] = None
    bbox: Optional[List[float]] = None
    sheet: Optional[str] = None
    cell: Optional[str] = None
    note: Optional[str] = Field(None, description="Note attached to the source, e.g. an Excel Notes cell")
    flagged: bool = Field(False, description="The source itself marks this value as uncertain")


class Candidate(BaseModel):
    """A value for a field as read from one source."""

    value: str
    source: SourceRef


Origin = Literal["human", "rule", "ai", "source"]
Absence = Literal["not_provided", "not_detected", "not_applicable"]


class FieldChange(BaseModel):
    at: str
    by: str
    origin: Origin = Field("human", description="Who proposed the value: a person, a code rule, the AI or a source file")
    old: Optional[str] = None
    new: Optional[str] = None
    reason: Optional[str] = None


class BriefField(BaseModel):
    key: str
    label: str
    section: str
    value: Optional[str] = None
    status: FieldStatus = "missing"
    confidence: float = 0.0
    sources: List[SourceRef] = Field(default_factory=list, description="Sources that support the current value")
    candidates: List[Candidate] = Field(default_factory=list, description="Every value read for this field")
    notes: List[str] = Field(default_factory=list)
    mandatory: bool = False
    on_artwork: bool = Field(False, description="Content the designer places on the pack")
    user_confirmed: bool = False
    not_applicable: bool = Field(False, description="A reviewer decided this field does not apply to the product")
    absence: Optional[Absence] = Field(None, description="Why an empty field is empty")
    history: List[FieldChange] = Field(default_factory=list)


class Issue(BaseModel):
    id: str = Field(..., description="Stable id: check + subject, so decisions survive re-checks")
    check: str
    severity: Severity
    kind: IssueKind
    category: str
    title: str
    description: str
    suggestion: Optional[str] = None
    fields: List[str] = Field(default_factory=list)
    evidence: List[SourceRef] = Field(default_factory=list)
    owner: Owner = "Brand"
    design_action: Optional[DesignAction] = None
    resolution: Literal["data", "design"] = Field(
        "data",
        description="data: a person must decide before handoff; design: becomes a designer task",
    )
    detected_by: Literal["code", "ai"] = "code"
    clauses: List[str] = Field(default_factory=list, description="Guideline clause ids this finding rests on")
    state: IssueState = "open"
    acknowledgement: Optional[str] = None


class PassedCheck(BaseModel):
    check: str
    title: str
    detail: str
    fields: List[str] = Field(default_factory=list)


class QuestionOption(BaseModel):
    id: str
    label: str
    updates: Dict[str, str] = Field(default_factory=dict, description="Field values applied when chosen")
    acknowledge: bool = Field(False, description="Choosing this passes the issue to the agency as open")
    recommended: bool = False


class Question(BaseModel):
    id: str
    issue_ids: List[str]
    fields: List[str]
    question: str
    why: str
    owner: Owner
    priority: Literal["must_answer", "should_answer"]
    options: List[QuestionOption]
    custom_field: Optional[str] = Field(None, description="Field a free-text answer is written to")
    ai_worded: bool = Field(False, description="The wording was rewritten by the AI; options and answers are code")
    original_question: Optional[str] = None


AnswerKind = Literal["option", "custom", "agency", "unknown", "not_applicable"]


class AnsweredQuestion(BaseModel):
    """A question as it was asked and how it was answered, kept for the record after it closes."""

    id: str
    question: str
    why: str
    owner: Owner
    priority: Literal["must_answer", "should_answer"]
    ai_worded: bool = False
    fields: List[str] = Field(default_factory=list)
    issue_ids: List[str] = Field(default_factory=list)
    options: List[QuestionOption] = Field(default_factory=list, description="The choices as offered, so the answer can be changed")
    custom_field: Optional[str] = None
    kind: AnswerKind
    answer: str
    option_id: Optional[str] = None
    note: Optional[str] = None
    at: str
    by: str
    # What the answer did, so changing it can undo exactly that and nothing a person did since.
    previous: Dict[str, Optional[str]] = Field(default_factory=dict, description="Field values before the answer")
    previous_confirmed: Dict[str, bool] = Field(default_factory=dict)
    applied: Dict[str, Optional[str]] = Field(default_factory=dict, description="Field values the answer set")
    na_fields: List[str] = Field(default_factory=list, description="Fields the answer marked not applicable")
    acknowledged: List[str] = Field(default_factory=list, description="Issues the answer passed to the agency")

    def as_question(self) -> Question:
        return Question(id=self.id, issue_ids=list(self.issue_ids), fields=list(self.fields), question=self.question,
                        why=self.why, owner=self.owner, priority=self.priority, options=list(self.options),
                        custom_field=self.custom_field, ai_worded=self.ai_worded)


class ChangeLogEntry(BaseModel):
    at: str
    by: str
    action: Literal["edit", "confirm", "answer", "acknowledge", "reopen", "finalize", "analyze", "files", "undo", "not_applicable", "duplicate"]
    origin: Origin = "human"
    field: Optional[str] = None
    issue: Optional[str] = None
    old: Optional[str] = None
    new: Optional[str] = None
    note: Optional[str] = None


class FileInfo(BaseModel):
    name: str
    kind: str
    size: int
    pages: Optional[int] = None


class AIStatus(BaseModel):
    provider: str = "none"
    model: Optional[str] = None
    enabled: bool = False
    used_for: List[str] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


class Readiness(BaseModel):
    score: int
    ready: bool
    fields_total: int
    fields_confirmed: int
    fields_needs_review: int
    fields_missing: int
    blocking_open: int
    warnings_open: int
    acknowledged: int
    questions_open: int
    headline: str


class BriefState(BaseModel):
    session_id: str
    created_at: str
    updated_at: str
    case: Case = "update"
    market: str = "US"
    source_market: Optional[str] = Field(None, description="New-market case: the market the existing pack was made for")
    source_session_id: Optional[str] = Field(None, description="The brief this one was duplicated from, if any")
    name_override: Optional[str] = Field(None, description="Product name set by a person; files do not overwrite it")
    category: str = "food"
    standards: List[str] = Field(default_factory=list, description="Selected standards; empty = by market")
    company_clauses: List[Clause] = Field(default_factory=list, description="Rules from an uploaded company rulebook, accepted by a reviewer")
    status: Literal["draft", "finalized"] = "draft"
    product_name: str = "Untitled product"
    files: List[FileInfo] = Field(default_factory=list)
    fields: List[BriefField] = Field(default_factory=list)
    issues: List[Issue] = Field(default_factory=list)
    passed_checks: List[PassedCheck] = Field(default_factory=list)
    questions: List[Question] = Field(default_factory=list)
    answered_questions: List[AnsweredQuestion] = Field(default_factory=list, description="Closed questions with their answers, oldest first")
    acknowledgements: Dict[str, str] = Field(default_factory=dict)
    change_log: List[ChangeLogEntry] = Field(default_factory=list)
    extraction_notes: List[str] = Field(default_factory=list)
    ai: AIStatus = Field(default_factory=AIStatus)
    readiness: Optional[Readiness] = None

    def field(self, key: str) -> Optional[BriefField]:
        for f in self.fields:
            if f.key == key:
                return f
        return None

    def value(self, key: str) -> Optional[str]:
        f = self.field(key)
        return f.value if f else None
