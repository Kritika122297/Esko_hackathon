# PackProofAI Audit Report

Audited 2026-10-22. Scope: `backend/` (FastAPI) and `frontend/` (Next.js 14). Secret values are never printed here.

## 0. Coverage and limits (read first)

| Done | Not done |
|---|---|
| Repo layout, README, DESIGN/PRODUCT docs, manifests, config | A line-by-line read of all ~20k lines. I read in full: `main.py`, `config.py`, `session_store.py`, `routers/common.py`, `routers/sessions.py`, `routers/export.py`, `routers/chat.py`, `services/llm.py`, `services/trace.py`, `frontend/src/lib/api.ts`, `next.config.mjs`, `tests/conftest.py`, plus the top of `routers/pack.py`. The check engine, extractors, file parser and exporters were not read file by file. |
| Backend test suite run: **164 passed, 0 failed** (6 min) | No browser or UI testing. Pages, responsive behaviour and accessibility were not exercised. |
| `tsc --noEmit`: clean. `next lint`: clean. `npm audit --omit=dev`: 2 vulns (1 critical, 1 high) | `next build` and the frontend dev server were not run. |
| Live API smoke test with AI disabled (a temporary server on port 8765, then removed) | Every AI path (vision, rules, claims, chat, OCR) is unverified. The tests force `LLM_PROVIDER=none`, and I did not use your keys. |
| `.env` / `.history` secret check (names only) | Git status. This directory is **not a git repository**, so there is no history or diff to inspect. |

Anything marked "unverified" below is a risk or a gap in evidence, not a confirmed bug.

## 1. Executive summary

PackProofAI reads packaging artwork (PDF) and content sheets (XLSX/DOCX/TXT/images), fills about 58 brief fields with source proof, runs deterministic compliance checks per market and category, turns gaps into ranked questions, and exports a designer brief (PDF/DOCX). AI is optional, advisory and validated by code.

**State:** a coherent, well-tested backend and a clean-compiling frontend. The design principle (code decides, AI suggests) is applied consistently in the code I read. The 164 passing tests assert specific seeded errors and false-alarm exclusions, which is stronger than render-only tests.

**Strengths:** atomic state writes and per-brief locks; strict session-id validation (a path-traversal probe returned 404); upload validation of extension, count, duplicate names and streaming size cap; whole-batch validation before writing; rollback on failed builds and file replacement; honest error contract (`detail`) mirrored by the frontend `ApiError`.

**Weaknesses:**
1. Live API keys sit in plaintext in two places, one outside any ignore rule.
2. No authentication or authorization anywhere.
3. Next.js 14.2.3 has published critical and high advisories.
4. No frontend tests, no CI, no e2e.
5. Disk and memory grow without bound.

**Biggest opportunities:** rotate and relocate keys, upgrade Next to 14.2.35 or later, add a small auth and retention layer if this leaves a demo setting, and add a Playwright smoke test on the sample pack.

## 2. Architecture

- **Frontend:** Next.js 14.2.3 App Router, React 18, Tailwind, Radix primitives, zustand (`store/briefStore.ts`). Routes: `/` (landing), `/projects`, `/upload`, `/analysis`, `/questions`, `/review`, `/export`. `/api/*` is proxied to the backend by `next.config.mjs` rewrites (`BACKEND_URL`, default `127.0.0.1:8000`, 120 s proxy timeout).
- **Backend:** FastAPI. Routers: standards, sessions, review, export, chat, pack. Services hold the logic: file parsing, extraction, merge, checks (market, nutrition, claims, sources), questions, designer brief, blueprint, agency simulator, autopilot, and the AI helpers.
- **Storage:** JSON files per session under `backend/uploads/<12-hex-id>/` (`state.json`, `context.json`, `extraction.json`, `chat.json`, `renders/`). An in-memory cache sits in front. There is no database. This is appropriate for a hackathon and single user, and not for multi-user.
- **AI:** provider-neutral client (`services/llm.py`) for Gemini or any OpenAI-compatible API, with six roles (vision, ocr, rules, claims, questions, chat), each with its own key, and fall-through `chain()`.
- **Rule data:** 19 JSON guideline packs (US/EU/India, by category).
- **Flow:** upload → `_create` → `autopilot.build` (read, extract, merge, check, optional AI) → `save_and_view` → JSON `SessionView` → pages; every edit calls `recompute` and re-saves.

## 3. Feature inventory

"Verified" means covered by a passing automated test run offline. Frontend behaviour was not run in a browser.

| Feature | Relevant files | Status | Evidence | Issues | Action |
|---|---|---|---|---|---|
| PDF/XLSX reading, panel detection, field fill with proof | `file_parser.py`, `extract_fields.py`, `merge.py` | Verified (backend, sample pack) | `test_sample_pack*.py`; smoke upload of the xlsx returned 201 in 0.5 s | Only the sample pack is covered; other artwork is untested | Add 2–3 more fixture packs |
| Deterministic checks (math, claims, market, nutrition) | `services/checks/*` | Verified | `expected_findings.json` plus false-alarm list | None found | Keep |
| Market/category rule packs | `guidelines/*.json`, `guidelines.py` | Verified (load and apply) | `test_guidelines.py`, `test_category_packs.py` | Legal accuracy of rule text is unverifiable here | Domain review |
| Cases: update / new market / new product | `sessions.py`, `pipeline.py` | Verified (backend) | `test_duplicate_market.py`, `test_fixes.py` | – | – |
| Questions and answers, re-check | `questions.py`, `routers/review.py` | Verified (API flow) | `test_autopilot_and_pack.py` | – | – |
| Finalize gate (409 with blockers) | `review.py` | Verified | Tests | – | – |
| Projects list, delete, duplicate to market | `sessions.py` | Verified | Tests; list and create smoke-tested | No auth (F-02) | Add auth |
| Add or replace files with rollback | `sessions.py:add_files` | Verified | `test_fixes.py` | – | – |
| Autopilot trace (poll and SSE) | `trace.py`, `sessions.py` | Implemented, partly verified | Tests cover the recorder; SSE not exercised live | Daemon thread per build, no cap (F-07) | Cap concurrency |
| Designer brief, PDF/DOCX export | `designer.py`, `brief_exporter.py`, `export.py` | Verified (content); exports exist in `exports/` | Tests; 3 PDFs on disk | Files never cleaned; same path is rewritten per request (F-06) | Temp file and cleanup |
| Dieline blueprint, agency simulator | `blueprint.py`, `agency_simulator.py` | Verified | `test_agency_simulator.py` | – | – |
| Chat assistant with citations and actions | `chat.py`, `routers/chat*.py` | Verified offline fallback only | `test_chat*.py` | LLM path unverified | Mock-LLM tests |
| Talk to the Pack (inspect/audit/fix) | `routers/pack.py` | Verified offline | `test_autopilot_and_pack.py` | AI audit unverified | – |
| Company rulebook import | `rulebook.py`, `ai_rules.py` | Verified (code path) | `test_rulebook.py`, `test_ai_rules.py` | AI extraction unverified | – |
| OCR (Tesseract or LLM) | `ocr.py` | Verified with mocks | `test_ocr.py` | Real Tesseract and LLM unverified | – |
| Vision cross-check, AI rules/claims/summary | `ai_assist.py`, `ai_summary.py` | **Unverified** | Tests disable the provider | – | Run once with keys, record results |
| Frontend: all 7 pages | `frontend/src/**` | **Unverified in browser** | Compiles and lints | – | Playwright smoke test |

## 4. Module findings

**`session_store.py`**
- `_session_locks` gains one `Lock` per id ever seen (including `chat-<sid>` keys) and is never pruned. Slow leak (F-08).
- `load()` caches every session forever. `list_projects` and `_same_files` call `load()` on every session on every upload or list, so cost is O(sessions) per request (F-08).
- Writes are atomic and ordered (`state.json` last). Good.

**`routers/sessions.py`**
- `_save_uploads` caps each file at 50 MB and the count at 20, so one request can still write about 1 GB. There is no total cap, no PDF page-count or render-size cap, and no rate limit (F-07).
- `market` is free text. It is only `.strip().upper()`d. Verified: a market of `<img src=x onerror=alert(1)>` was accepted (201) and appears in `GET /sessions`. React escapes it on render, so there is no confirmed XSS, but the value reaches rule lookup, exports and filenames (F-09).
- `background=true` starts an unbounded daemon thread per request.
- `page_image` uses `Path(image).name`, so traversal is closed. Good.

**`routers/export.py`**
- `settings.EXPORT_DIR / f"{sid}_{name}"` is written on every GET and never removed. Two concurrent exports of one brief write the same file (F-06).
- Each export calls `summarize()`, which makes an LLM call when a provider is set, so repeated GETs cost tokens. The cache is keyed on `updated_at`, which is fine, but there is no rate limit.

**`services/llm.py`**
- Transient-error detection is substring-based (`"500" in str(err)`), so any message containing those digits is retried once. Harmless, but imprecise. The long line at 84 has stray whitespace.
- A new `genai.Client` is created per call.
- `_parse_json` falls back to a greedy `{...}` regex. Acceptable because callers validate output.
- `/api/health` reports a `model` name even when the provider is `none` (the cosmetic leak seen in the smoke test).

**`routers/chat.py`**
- Locking order (chat lock, then brief lock) is documented and consistent. A slow AI reply does not block edits. Good.

**`frontend/src/lib/api.ts`**
- `upload` and `uploadStart` duplicate about 15 lines of form building.
- `deleteProject` and `clearChat` bypass `send()`. `clearChat` ignores failure silently, so a failed clear looks successful.
- `(detail as any)` casts in `api.ts:34` and `Notice.tsx:15`. Minor.
- `NEXT_PUBLIC_API_URL` points the browser straight at the backend, which then depends on CORS. The default proxied path is fine.

## 5. Defect and risk register

| ID | Issue | Severity | Area | Evidence | Fix |
|---|---|---|---|---|---|
| F-01 | Live API keys in plaintext: `backend/.env` (5 keys set) **and** `.history/backend/.env_20261022054212` (5 keys), a copy made by an editor history extension. `.history/` has no ignore rule, and there is no git repo. | **High** (confirmed) | Secrets | Key-name check (values not read) | Rotate the Gemini and Groq keys now. Add `.history/` to ignore rules and delete those copies. Never zip or share the folder before that. |
| F-02 | No authentication or authorization. Any client that can reach the API can list, read, edit, finalize and delete every brief and download files. CORS restricts browsers only. | High if deployed, Low if local-only | API | `GET /sessions` and `DELETE` work with no credentials | Add auth (even one shared token) and per-user session ownership before any deployment. |
| F-03 | Next.js 14.2.3 with published advisories (RCE, SSRF in rewrites, cache confusion, server-function disclosure) and a vulnerable PostCSS dependency. This app uses `rewrites`. | High (npm audit); exploitability unverified | Dependencies | `npm audit --omit=dev`: 1 critical, 1 high | Upgrade to the latest 14.2.x patch. `audit fix --force` proposes 14.2.35, so review the diff, run lint, tsc and a build. |
| F-04 | No frontend tests, no CI, no e2e. The 6-minute backend suite is the only gate. | Medium | Testing | No test files under `frontend/` | Add Playwright covering upload → questions → finalize → export. Speed up the slow tests. |
| F-05 | Real user content sits in the project folder: `uploads/` (6 sessions), `exports/` (3 PDFs). Both are in `backend/.gitignore`, but there is no repo, so a copy or zip would include them. | Medium | Privacy | File listing | Keep the data directory outside the project, and add a retention or cleanup job. |
| F-06 | Export files are never deleted. Concurrent exports of one brief write the same path. | Medium | Export | `export.py:187` | Stream from memory or a temp file, delete after send. |
| F-07 | No total upload cap, no rate limit, unbounded background threads, and no PDF page or render limits. A few large uploads can exhaust disk, CPU or memory. | Medium | Reliability / abuse | `_save_uploads`, `create_session` | Cap the total size and concurrent builds, limit pages, and add a rate limit. |
| F-08 | Memory and lock growth: the session cache and the lock dict are never evicted. Listing and duplicate detection load every session. | Low–Medium | Scalability | `session_store.py` | LRU the cache, prune locks, and keep a lightweight index. |
| F-09 | `market` is not validated against known markets. | Low | Validation | Verified with a markup string | Validate against the markets in `market_profiles.json`, or restrict to `[A-Z]{2,5}`. |
| F-10 | `clearChat` swallows failures. `deleteProject` ignores non-404 details. | Low | Frontend | `api.ts` | Route through `send()`. |
| F-11 | `/api/health` shows a model name when the provider is `none`. | Info | API | Smoke test | Return `null` when disabled. |
| F-12 | Docs drift: the README says "5 screens"; the code has 7 routes. `backend/venv`, `__pycache__` and `.history` live inside the project tree. | Info | Docs | – | Tidy. |
| F-13 | Prompt injection: document text goes into LLM prompts. The design mitigates it (AI output is advisory, quotes are checked against clause text, and fixes are previewed and applied explicitly). | Risk, unverified | AI | Design docs and code comments only | Add tests that feed an injected document through a stubbed LLM. |

No SQL, shell or `dangerouslySetInnerHTML` use turned up in the greps I ran. Four `eslint-disable` comments exist, all for `exhaustive-deps` or `<img>`.

## 6. UI/UX audit

**Not performed.** I did not open the UI in a browser, so I make no claims about visual quality, responsiveness, contrast, keyboard use or focus handling. What I can say from the source:
- A written design system exists (`DESIGN.md`, `PRODUCT.md`, Tailwind tokens, shared `components/ui` and `components/shared` such as `Notice`, `badges`, `Segmented`).
- Loading and error states are centralized (`Notice`, `ApiError`).

The next step is a Playwright or screenshot pass at 375, 768, 1280 and 1920 px with axe-core, on the sample pack.

## 7. Security summary

Confirmed: F-01 (secrets), F-02 (no auth), F-03 (dependencies), F-09 (unvalidated market). Positive controls verified: session-id regex, upload extension allow-list and size cap, a path-traversal probe returning 404, and CORS rejecting an unlisted origin (400 on preflight).

## 8. Performance

Measured: the sample xlsx builds in about 0.5 s with AI off. The backend suite takes 6 min (a developer-loop cost). Everything else is a likely opportunity, not a measurement: LLM latency (90 s timeout, one retry, a 120 s proxy limit), per-request O(n) session scans, and the unbounded cache.

## 9. Recommended roadmap

1. **Today:** rotate the keys (F-01), delete the `.history` copies, add ignore rules.
2. **This week:** upgrade Next (F-03) and re-run lint, tsc and a build. Validate `market` (F-09). Fix export temp files (F-06).
3. **Before any deployment:** auth and ownership (F-02), upload and rate limits (F-07), cache and lock eviction (F-08).
4. **Quality:** Playwright smoke and responsive/a11y pass (F-04). Run the AI paths once with keys and record the outcome. Add stub-LLM injection tests (F-13).

## 10. Test log

| Test | Method | Expected | Actual | Result |
|---|---|---|---|---|
| Backend suite | `pytest -q` in `backend/` (offline) | All pass | 164 passed, 6 warnings, 363 s | Pass |
| Types | `tsc --noEmit` | No errors | No output | Pass |
| Lint | `next lint` | Clean | "No ESLint warnings or errors" | Pass |
| Dependency audit | `npm audit --omit=dev` | None | 1 critical, 1 high (Next, PostCSS) | Fail (F-03) |
| Health | `GET /api/health` | 200 | 200, AI disabled | Pass |
| Path traversal | `GET /sessions/..%2f..%2fetc` | 404 | 404 | Pass |
| Unknown session | `GET /sessions/aaaaaaaaaaaa` | 404 | 404 with message | Pass |
| Bad extension | upload `a.exe` | 400 | 400 with message | Pass |
| Bad category | `category=bogus` | 400 | 400 listing valid categories | Pass |
| Foreign-origin preflight | `OPTIONS` with `Origin: evil.example` | Rejected | 400 | Pass |
| Unvalidated market | `market=<img…>` | Rejected | 201, stored | Fail (F-09) |
| Unauthenticated list and delete | `GET /sessions`, `DELETE` | Rejected | Allowed | Fail (F-02) |
| Browser UI, `next build`, AI paths | – | – | Not run | Blocked/unverified |
