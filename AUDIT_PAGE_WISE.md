# PackProofAI: Page-wise Audit (check and fix list)

Companion to `AUDIT_REPORT.md`. Frontend only; backend items stay in that report.

**How to read it.** Each page has a table of issues: ID, what is wrong, where, how to check it, the fix and the priority.
- **Read** = confirmed by reading the code (the reasoning is in the row). Not yet seen in a browser.
- **Browser** = needs eyes on a running page. I did not run the UI, so none of the visual, responsive or keyboard checks are done. Those rows are marked *to check*.
- Priority: **P1** fix first, **P2** soon, **P3** polish.

Not read in full: `landing/Sections.tsx`, `PackPreview.tsx`, `ExampleCarton.tsx`, `BriefEditor.tsx`, `QuestionCard.tsx`, `IssuesList.tsx`, `ArtworkViewer.tsx`, `PackInspectorCard.tsx`, `DesignerBriefView.tsx`, `DielineBlueprint.tsx`, `AgencySimulator.tsx`. Those pages' inner behaviour is unaudited.

## Page map

| # | Page | Route | File | Read in full? |
|---|---|---|---|---|
| 0 | App shell (header, brief bar, chat, toast) | all `(app)` routes | `app/(app)/layout.tsx`, `ChatPanel.tsx`, `store/briefStore.ts`, `useSession.ts` | Layout, store, hook, first 200 lines of chat |
| 1 | Landing | `/` | `app/page.tsx` + `components/landing/*` | Page file only |
| 2 | Projects | `/projects` | `app/(app)/projects/page.tsx` | Yes |
| 3 | New brief (Upload) | `/upload` | `app/(app)/upload/page.tsx`, `FileDropzone.tsx`, `AutopilotTimeline.tsx` (first 130 lines) | Page yes |
| 4 | Findings (Analysis) | `/analysis` | `app/(app)/analysis/page.tsx` | Page yes; `IssuesList`, `ArtworkViewer` no |
| 5 | Questions | `/questions` | `app/(app)/questions/page.tsx` | Page yes; `QuestionCard` no |
| 6 | Workbench (Review) | `/review` | `app/(app)/review/page.tsx` | Page yes; `BriefEditor`, `PackInspectorCard` no |
| 7 | Designer brief (Export) | `/export` | `app/(app)/export/page.tsx` | Page yes; `DesignerBriefView` no |

---

## 0. App shell and shared state (affects every page)

What works (Read): `useSession` accepts `?session=<12-hex>` and validates it. A deleted brief (404) is forgotten cleanly. A stale `load` is discarded (`viewSeq`). Only one mutating action runs at a time (`inFlight`). The chat panel is `inert` when closed, moves focus in and out, and acts as a modal on small screens. Hooks are called before every early return on all pages.

| ID | Issue | Where | Check | Fix | Pri |
|---|---|---|---|---|---|
| S-1 | A second action while one is running is silently dropped: `run()` and `start()` return `false` with no message. A quick double action (edit, then confirm) loses the second click and the user is told nothing. | `briefStore.ts:117-121, 135-137` | *Browser:* click Confirm on two fields quickly and see whether the second one is ignored with no message. | Return a reason, or queue the call. At minimum show "Another change is still saving". | P2 |
| S-2 | Persisted `sessionId` lives in localStorage under one key, so every tab shares "the open brief". Opening brief B in tab 2 changes what tab 1 loads on its next refresh. | `briefStore.ts:159` | *Browser:* open two tabs on different briefs, reload tab 1. | Prefer the `?session=` URL as the source of truth, and keep the persisted id only as a fallback. | P3 |
| S-3 | Unused API helpers: `api.upload`, `api.exportUrl`. Nothing calls them. | `lib/api.ts` | `grep -rn "api.upload(\|exportUrl" src` finds no callers. | Delete both, or reuse one form builder (they duplicate `uploadStart`). | P3 |
| S-4 | `clearChat` ignores failures, so a failed clear looks successful. `deleteProject` bypasses `send()`. | `lib/api.ts` | *Read.* | Route both through `send()`. | P3 |
| S-5 | Pages return `null` until `ready`, so there is a blank frame on first paint. | all pages (`if (!ready) return null`) | *Browser:* reload with throttling and watch for a flash. | Render the `Loading` skeleton instead. | P3 |
| S-6 | `Fold`/`disclosure` hides content with `aria-hidden` plus height 0 and `overflow:hidden`, but never `visibility:hidden` or `inert`. Controls inside a closed fold stay in the tab order while hidden from screen readers. This breaks WCAG 4.1.2/2.4.3. | `globals.css:201-212`, `upload/page.tsx:114` | *Browser:* Tab through `/upload` with all folds closed. Focus should not vanish into invisible checkboxes or the file input. | Set `inert` (or `visibility:hidden` after the transition) when closed. Affects `Fold`, the change log and the `AutopilotTimeline` rows. | P2 |

---

## 1. Landing `/`

Read: `app/page.tsx` only (hero, example, workflow, features, principles, CTA, footer). The Sections, PackPreview and nav files were skimmed for links only.

| ID | Issue | Where | Check | Fix | Pri |
|---|---|---|---|---|---|
| L-1 | All link targets found in the landing components are `/upload`, `/projects` and `/`. No dead links in the ones I grepped. | `components/landing/*` | Read (grep of `href`). Anchor links to sections were not found, so the nav "Workflow/Features" items may be scroll buttons. *To check.* | – | – |
| L-2 | The hero uses `clamp(52px,8.6vw,128px)` and `anim-line` animations. | `app/page.tsx:20` | *Browser:* check 375 px width for overflow or awkward wrapping, and check `prefers-reduced-motion` (`globals.css:415` has a rule). | Visual check only. | P3 |
| L-3 | The example pack is illustrative and labelled as such ("illustrative data"). That is honest. | `app/page.tsx:51` | – | Keep. | – |

---

## 2. Projects `/projects`

Works (Read): loading, error with retry, empty state, filter tabs with counts, search (remembered per browser tab), sort, duplicate-to-market dialog, delete.

| ID | Issue | Where | Check | Fix | Pri |
|---|---|---|---|---|---|
| P-1 | Delete uses the native `window.confirm`, while the rest of the app uses styled Radix dialogs. It looks out of place, and the text cannot be styled or made keyboard-friendly in a custom way. | `projects/page.tsx:139` | *Browser:* click the trash icon. | Use the existing dialog pattern (as in `DuplicateMarketModal`). | P2 |
| P-2 | No per-row pending state. While a delete or open is running, only the global `busy` disables the "New market" button. A double click on the trash icon shows the confirm twice. | `projects/page.tsx:138-149, 329-343` | *Browser:* double-click Delete. | Track `deletingId` and disable that row. | P3 |
| P-3 | Delete on a server error shows the error, and `finally` always refreshes. A brief that was actually deleted but returned an error is handled fine; this is OK. | `projects/page.tsx:141-148` | Read. | – | – |
| P-4 | No auth: this page lists **every** brief on the server. | backend F-02 | `GET /sessions` | See `AUDIT_REPORT.md` F-02. | P1 if shared |
| P-5 | The list is not paginated and loads full summaries; every refresh makes the backend load every session (F-08). | `projects/page.tsx:113-122` | Create 100+ briefs. | Paginate or add a lightweight index on the backend. | P3 |
| P-6 | `statusText()` builds `"Draft " + "Ready to finalize"` with no separator. It is used only for search, so users won't see it, but searching "draft ready" behaves oddly. | `projects/page.tsx:52-55` | Search "Draft Ready". | Add a separator. | P3 |
| P-7 | The readiness bar has `role="presentation"`, so assistive tech gets only the number text. Fine, since the number is visible. | `projects/page.tsx:75` | – | – | – |
| P-8 | Markup indentation around the delete button is off (lines 332-344). Cosmetic. | `projects/page.tsx:332` | – | Run Prettier. | P3 |

---

## 3. New brief `/upload`

Works (Read): case selection (3 radio cards), market, category, rule-set picker, company rulebook import with per-rule tick boxes, new-product checklist, file dropzone with type and size limits, duplicate-brief banner, background build with live timeline and polling fallback.

| ID | Issue | Where | Check | Fix | Pri |
|---|---|---|---|---|---|
| U-1 | **Race in the rules effect.** The effect calls the API for the current market, category and rule sets but never cancels. If the user changes market twice quickly, a slower earlier response can overwrite the later one, so the "Rules that will be applied" box shows the wrong market. | `upload/page.tsx:297-305` | *Browser:* throttle the network, switch US → EU → IN quickly, and compare the box with the dropdown. | Add a `cancelled` flag in the effect cleanup. | P2 |
| U-2 | A failed standards or rules fetch is swallowed: `setRules(null)` hides the box, `setOptions(null)` falls back to a lone "United States". The user sees no error and a reduced market list. | `upload/page.tsx:294-305` | Stop the backend, load `/upload`. | Show a notice with retry when the lists fail. | P2 |
| U-3 | While a build runs, the form is dimmed with `pointer-events-none` only. Keyboard users can still Tab into the form and change the case, market and files during the build. | `upload/page.tsx:387` | *Browser:* start a build, then press Tab and Space. | Wrap the form in `inert` when `analyzing`. | P2 |
| U-4 | Dead code: `BUSY_LABEL` is compared in `analyzing` but nothing ever sets the store's `busy` to it (the page uses the background `uploadStart`). `Processing` shows only for the short `submitting` moment, and its text says "Sending the files". | `upload/page.tsx:236-262, 292` | `grep -rn BUSY_LABEL src` | Remove `BUSY_LABEL`; keep `Processing` only if wanted for the submit moment. | P3 |
| U-5 | "Another market (general checks only)" sends the literal `OTHER` as the market. The backend stores any text (F-09), so the brief's market badge shows "OTHER". | `upload/page.tsx:47, 456` | Choose it, build, look at Projects. | Validate server-side; show "General" in the UI. | P3 |
| U-6 | Closed `Fold`s keep their checkboxes and file input focusable (S-6). | `upload/page.tsx:105-121` | *Browser:* Tab through. | See S-6. | P2 |
| U-7 | The rulebook's **same-file re-pick** works only because the input unmounts after a proposal. Fine; noted. Rulebook upload has no client-side size or type check beyond `accept`. | `upload/page.tsx:195` | Pick a 200 MB `.pdf`. | Reuse the 50 MB check from the dropzone. | P3 |
| U-8 | Build progress uses `EventSource` through the Next rewrite proxy. Some proxies buffer SSE; the code falls back to polling, so it degrades gracefully, but I did not see the live stream. | `AutopilotTimeline.tsx:127-` | *Browser:* upload the sample pack and watch whether rows appear one by one. | – | Verify |
| U-9 | The "Build the brief" button is disabled when any `busy` is set, including "Loading brief" from the store. Probably harmless. | `upload/page.tsx:552` | Open `/upload` right after loading a brief. | – | P3 |

---

## 4. Findings `/analysis`

Works (Read): header counts, artwork viewer with panels, findings list, "Read report" ledger (files read, panels, fields, checks passed, unreadable).

| ID | Issue | Where | Check | Fix | Pri |
|---|---|---|---|---|---|
| A-1 | **Two definitions of "blocking".** This page counts open issues where `severity==="blocking" && resolution==="data"`; the Workbench header uses `readiness.blocking_open` from the backend. The numbers can differ for the same brief, for example when a blocking issue is routed to the agency. | `analysis/page.tsx:23` vs `review/page.tsx:155` | *Browser:* compare "N decisions block the brief" here with "N blocking" on `/review` for the sample pack. | Use `readiness.blocking_open` everywhere. | P1 (trust) |
| A-2 | The lead text says "found **N definite errors by code**", but `definite` counts every issue with `kind==="definite"`, including resolved or acknowledged ones and any not detected by code. | `analysis/page.tsx:24, 33` | Resolve an issue, then reload `/analysis`. | Filter on `state==="open"` and `detected_by!=="ai"`. | P2 |
| A-3 | `mainPanels` is `panels.filter(id has no "_")`, and "flaps mapped" is the rest. That depends on a backend id naming convention; a panel id with an underscore would be counted as a flap. | `analysis/page.tsx:21, 96` | Read; check how panel ids are generated in `file_parser.py` (~line 232). | Return an explicit `kind` on each panel. | P2 |
| A-4 | A new product with no artwork shows "0" panels in large type. The note says artwork is missing, which is fine, but the "0" reads as a failure. | `analysis/page.tsx:86` | Build a New product brief. | Show "–" when there are no pages. | P3 |
| A-5 | The ledger bar is `aria-hidden`; the numbers are in the text just above. Good. The legend is colour only (dot colours) but also has text. | `analysis/page.tsx:113-122` | – | – | – |
| A-6 | Sticky layout: the artwork viewer and findings each have `sticky` plus `max-h` calculations from a CSS variable. | `analysis/page.tsx:47-50` | *Browser:* check at 1024, 1280 and 1920 px, and with a very long findings list, for overlap or clipped content. | – | Verify |

---

## 5. Questions `/questions`

Works (Read): owner routing board with progress, To answer / Answered tabs, search with counts, empty states, jump links per owner.

| ID | Issue | Where | Check | Fix | Pri |
|---|---|---|---|---|---|
| Q-1 | Owners are limited to a fixed list: `R&D, Legal, Supply Chain, Brand, Agency`. A question whose owner is anything else is **counted** in the header ("N must be answered") but **never rendered**. Today every backend owner is in that list (I checked the Python and the JSON rule packs), so this is a latent risk, not a live bug. A company rulebook or a future rule pack can break it. | `questions/page.tsx:15, 50, 59` | Add a rule with owner "Quality" to a test brief. | Build `owners` from the data, ordering the known ones first. | P2 |
| Q-2 | The page's `n` index is a mutable counter changed during render. It works, but it is fragile under concurrent rendering. | `questions/page.tsx:61, 214` | Read. | Compute indexes with `map` over a pre-flattened list. | P3 |
| Q-3 | Owner cards use an `<a>` without `href` when the owner has no matches. It is not focusable and has `aria-disabled`; screen readers may announce a link. | `questions/page.tsx:100-104` | *Browser:* Tab across the routing board. | Render a `<div>` for the disabled state. | P3 |
| Q-4 | `QuestionCard` (the answer controls, "why am I asked this?", custom value input) was **not read**. It is the most important control on this page. | `components/questions/QuestionCard.tsx` | – | Audit next: validation of custom values, double submit, error display. | Verify |
| Q-5 | After answering the last open question, `tab` stays on "open" unless the user picked one; the page then shows "Nothing left to answer" with a button. Good flow. | `questions/page.tsx:52` | – | – | – |

---

## 6. Workbench `/review`

Works (Read): readiness card, artwork with click-to-inspect, brief editor, findings, change log, mobile switch between fields and findings.

| ID | Issue | Where | Check | Fix | Pri |
|---|---|---|---|---|---|
| R-1 | **Everything is mounted twice.** `ArtworkViewer` and `PackInspectorCard` are rendered once in the `xl` column and once in the middle column, each hidden with CSS only (`hidden xl:block` / `xl:hidden`). The same goes for `ReadinessCard` (lines 67 and 144). Two copies means two image loads, two sets of state, duplicate element ids, and, when a field is inspected, **two `inspect` requests and two audit/fix states** that can diverge. | `review/page.tsx:82-108, 66-68, 143-145` | *Browser:* open DevTools → Network, click a value on the pack, and count `/inspect` calls. Search the DOM for duplicate ids. | Pick one with a `useMediaQuery("(min-width:1280px)")` hook and render a single instance. | P1 |
| R-2 | The change log shows the time as `c.at.slice(11,16)`. `at` is a UTC ISO string, so users see **UTC hours and minutes with no date or zone**. Projects shows local time, so the two pages disagree. | `review/page.tsx:128` | *Browser:* make an edit and compare with your clock. | Format with `toLocaleString` like Projects does. | P1 (confusing) |
| R-3 | The "first field to review" auto-highlight depends on `[view?.state.session_id]` only, with an `eslint-disable`. If the brief reloads with the same id and nothing is highlighted, it does not re-select. Low impact. | `review/page.tsx:37-42` | – | Fine as is, or derive from a ref. | P3 |
| R-4 | The change-log list uses `key={i}` on a reversed list, which re-keys every row when an entry is added. | `review/page.tsx:126` | – | Use a stable id (`at` + index). | P3 |
| R-5 | `BriefEditor` (the core editing UI), `PackInspectorCard`, `IssuesList` and `ArtworkViewer` were **not read**. | `components/review/*`, `analysis/IssuesList.tsx` | – | Audit next: edit validation, confirm vs edit, impact preview, finalize gate, undo. | Verify |
| R-6 | Mobile: the artwork + inspector sits above the fields. The pane switch hides findings via classes. | `review/page.tsx:66-78, 100, 148` | *Browser:* 375 px, check the findings pane and sticky offsets. | – | Verify |

---

## 7. Designer brief `/export`

Works (Read): fetches the brief, shows a DRAFT banner, downloads Word or PDF through `fetch` (errors are shown in-page rather than as raw JSON), live status for screen readers.

| ID | Issue | Where | Check | Fix | Pri |
|---|---|---|---|---|---|
| E-1 | An error from loading the designer brief is **never cleared**. `setError` is set on failure, and a later successful fetch (after an edit changes `updated_at`) calls `setBrief` but not `setError(null)`. The old red message stays above the new brief. | `export/page.tsx:49-52, 104-108` | Make `GET /designer-brief` fail once (stop the backend briefly), restart, edit a field, return. | Clear `error` at the start of each fetch. | P2 |
| E-2 | The fetch effect has no cancellation and `brief` is not reset when the session changes, so the previous brief's content shows until the new one arrives, and a slow old response can overwrite a newer one. | `export/page.tsx:49-52` | *Browser:* open brief A's export, switch to B via Projects. | Add a `cancelled` flag; `setBrief(null)` when `sessionId` changes. | P2 |
| E-3 | Each download triggers a backend export, which writes a file that is never deleted and may call the AI for the summary (backend F-06). Two clicks on different formats are blocked by `preparing`, which is good. | `export/page.tsx:28-47` | – | See `AUDIT_REPORT.md` F-06. | P2 |
| E-4 | Download buttons are duplicated at the top and bottom, which is fine. Both disable on global `busy`, so they stay disabled if a store action hangs. | `export/page.tsx:71-78, 123-130` | – | – | P3 |
| E-5 | Printing: `no-print` is used on the bottom panel. `DesignerBriefView` print styling was not read. | `export/page.tsx:111` | *Browser:* Ctrl+P. | – | Verify |

---

## Cross-page priority list

| Pri | IDs | Why |
|---|---|---|
| P1 | R-1, R-2, A-1 | Wrong or duplicated information shown to the user |
| P2 | U-1, U-2, U-3, S-6/U-6, A-2, A-3, Q-1, E-1, E-2, P-1, S-1 | Race conditions, silent failures, accessibility |
| P3 | the rest | Polish and cleanup |

## What to open in the browser (fastest checklist)

1. Sample pack → `/upload`: watch the Autopilot rows arrive live (U-8), then Tab through the page with folds closed (S-6).
2. `/analysis` vs `/review`: compare the blocking counts (A-1).
3. `/review`: click a value on the pack; count `/inspect` requests (R-1). Make an edit; compare the change-log time with your clock (R-2).
4. `/questions`: answer one, undo it, answer "I don't know" (Q-4 is unread code).
5. `/export`: download both formats; stop the backend and retry to see the error text (E-1).
6. Repeat 1–5 at 375, 768 and 1280 px, and with the keyboard only.
