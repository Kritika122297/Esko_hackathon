# BriefForge backend

FastAPI service. See the root README for the overview and setup.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Status and AI provider |
| POST | `/api/sessions` | Multipart upload (`files`, `case`, `market`): read, fill, check |
| GET | `/api/sessions` | All briefs (projects), most recently changed first |
| DELETE | `/api/sessions/{id}` | Delete a brief and its files |
| POST | `/api/sessions/{id}/chat` | Ask about one brief; answers cite fields and findings |
| GET | `/api/sessions/{id}` | Brief state, page renders, panels |
| GET | `/api/sessions/{id}/pages/{image}` | Rendered artwork page |
| PUT | `/api/sessions/{id}/fields/{key}` | Edit a value (logged, re-checked) |
| POST | `/api/sessions/{id}/fields/{key}/confirm` | Approve a value as correct |
| POST | `/api/sessions/{id}/questions/{qid}/answer` | Pick an option or give a value |
| POST | `/api/sessions/{id}/issues/{iid}/acknowledge` | Pass an issue to the agency as an open question |
| POST | `/api/sessions/{id}/issues/{iid}/reopen` | Undo that |
| POST | `/api/sessions/{id}/impact` | Preview what a change would resolve or introduce |
| POST | `/api/sessions/{id}/finalize` | 409 while blocking decisions are open |
| POST | `/api/sessions/{id}/reopen` | Back to draft |
| GET | `/api/sessions/{id}/designer-brief` | Keep / Change / Add / Remove / Unknown brief |
| GET | `/api/sessions/{id}/export/{pdf\|docx}` | Download |

## Adding a check

Checks live in `app/services/checks/`. Each one reads current field values through `Ctx`, and calls `ctx.add(...)` with a stable id, severity, kind, owner, evidence and suggestion, or `ctx.ok(...)` when it passes. Add a question template for it in `app/services/questions.py` if a person needs to decide, and add a line to `tests/expected_findings.json`.
