# BriefForge

**From product idea to design brief.** Esko AIForge Hackathon, Problem Statement 1.

> AI reads and suggests. Code checks. Humans decide.

BriefForge takes the messy starting point of a packaging project (the current carton PDF, a content sheet, notes) and produces a design brief an agency can use. Every value shows where it came from. Every number is checked by code. Every gap or conflict becomes a short, ranked question. Nothing is invented.

## What it does with the Esko sample pack

Upload the two files in `samples/` (Dancing Fish Granola, US carton PDF and content sheet) like any product's files, and BriefForge:

- Reads the dieline, finds the 16 panels from the crease lines, names them from the guide labels (front/PDP, back, sides, flaps) and ignores printing-guide text such as "Art orientation" and "Copy free".
- Fills 58 brief fields, each with proof: artwork panel and position, or Excel cell plus its note.
- Finds every error planted in the sample, plus several that are not obvious:

| Found by code | Example |
|---|---|
| Math | Sugars 18 g > carbohydrate 15 g; calories 166 vs 330 calculated; 8 × 85 g ≠ 480 g; 10 wrong %DV figures; honey 9% makes the ingredient order impossible |
| Files disagree | Artwork prints carbohydrate **66 g** and sodium **23 mg**; content sheet says 15 g and 25 mg; ingredient lists differ (walnuts, flax, honey 1% vs 9%) |
| Claims and allergens | Vegan claim with honey and 45 mg cholesterol; "No Added Sugar" with honey and coconut sugar; "May contain" almonds that are ingredients; EU allergen wording |
| US label rules | No ounces on net weight; net weight not on the front panel; serving size without a unit; producer without an address; no organic certifier statement |
| Artwork file hygiene | A **hidden EU "per 100 g" nutrition table** under the US panel (found from the PDF drawing order); EU reference-intake icons on a US pack |
| Spec sheet | Nutrition columns for 480 g and 1000 g are the per-serving values multiplied by pack weight |

It also shows the checks that **passed** (barcode check digit, fat breakdown, all 14 Nutrition Facts lines present), so reviewers can trust what is not flagged.

## The workflow

0. **Projects**: every brief on the server, with readiness and blocking counts. Open, delete, or start a new one; each upload is its own brief.
1. **New brief**: choose the situation (update existing pack / new market / new product) and the market, then upload the product's files.
2. **Findings**: what was read and what the checks found, with evidence highlighted on the artwork.
3. **Questions**: only real decisions, grouped by who can answer (R&D, Legal, Supply Chain, Brand), each with "why am I asked this?" and one-click answers computed by code from your own files.
4. **Workbench**: artwork, editable brief and findings side by side. Click a value to see its source on the box. "Preview impact" shows what a change would fix or break before saving (Change Impact Simulator). The readiness dashboard and the finalize gate: blocking items must be answered or passed to the agency as open questions.
5. **Designer brief**: Keep / Change / Add / Remove / Unknown, an annotated box layout, approved copy, Nutrition Facts, open questions, proof table, change log. Export to PDF or DOCX.

Every brief also has **Ask about this brief**, a chat panel that answers only from that brief's own data (values and their sources, findings, questions and owners) and links each answer to the cited field or finding. With an AI provider configured the wording is generated and every citation is checked by code; without one, or if the provider fails, built-in answers cover status, blockers, missing data, file conflicts, owners and any field.

## How uncertainty is handled

- **Three field states**: Confirmed (sources agree, checks pass, or a reviewer approved it), Needs review (conflict, doubtful or assumed), Missing (no source has it).
- **Honest issue labels**: Definite error / Likely problem / Needs human check, and Blocking / Warning / Info.
- **Never invented**: a value only comes from a file or a person. "Not clearly legible" in the content sheet stays empty.
- **Code beats AI on anything calculable**. AI findings are always "Needs human check" and never block.
- **Limits are shown**: logos, seals and barcode digits are images, so the app says it could not read them.
- **Everything is logged**: who changed what, old and new value, and why.

## Architecture

```
Next.js 14 (TypeScript, Tailwind)        5 screens, artwork viewer with evidence boxes
        │  /api (proxied by next.config.mjs)
FastAPI (Python)
  ├─ Readers        PyMuPDF: text with positions, page renders, dieline grid, hidden-text detection
  │                 openpyxl: label/value/note groups, highlighted cells, nutrition tables
  ├─ Extract+merge  rules turn fragments into candidates with proof; sources compared field by field
  ├─ Checks         plain Python: math, claims, allergens, US rules, artwork hygiene (~30 checks)
  ├─ Questions      ranked, merged per field, answers re-run all checks
  ├─ AI (optional)  vision cross-check of printed values + second opinion on claims, validated by code
  ├─ Designer brief Keep / Change / Add / Remove / Unknown, PDF + DOCX export
  └─ Sessions       JSON on disk per session (backend/uploads/<id>/)
```

## Run it

Prerequisites: Python 3.11+ (tested on 3.13) and Node 18+.

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env           # optional: AI settings
uvicorn app.main:app --port 8000

# Frontend (second terminal)
cd frontend
npm install
npm run dev                      # http://localhost:3000
```

Open http://localhost:3000, click **New brief** and drop in the two files from `samples/`. API docs are at http://localhost:8000/api/docs.

### Tests (seeded-error report)

```bash
cd backend
venv\Scripts\python -m pytest -q
```

`backend/tests/expected_findings.json` lists every planted error and the check that must catch it, plus things that must **not** be flagged (false alarms). The suite also runs on a changed copy of the content sheet, and walks the API flow end to end (answer → re-check → finalize gate → export).

### AI provider (optional)

The app is fully functional with `LLM_PROVIDER=none`. To enable the vision cross-check, set in `backend/.env`:

```bash
# Google AI Studio
LLM_PROVIDER=gemini
LLM_API_KEY=...
LLM_MODEL=gemini-3.8-flash

# or any OpenAI-compatible API (Groq, OpenRouter, a local Ollama, ...)
LLM_PROVIDER=openai_compatible
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=...
LLM_MODEL=<a vision-capable model>
```

## Project layout

```
backend/app/
  services/file_parser.py     readers (PDF, Excel, Word, notes, images)
  services/extract_fields.py  fragments -> candidate values with proof
  services/merge.py           combine sources into brief fields
  services/checks/            sources, nutrition, claims, market rules
  services/questions.py       question engine
  services/ai_assist.py       optional AI, validated by code
  services/designer.py        designer brief
  routers/                    sessions, review (edit/answer/ack/impact/finalize), export
frontend/src/
  app/                        upload, analysis, questions, review, export
  components/                 artwork viewer, issues, brief editor, designer brief
samples/                      Esko sample files
```
