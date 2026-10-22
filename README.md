# PackProofAI

**Catch it in the brief, not on press.** Esko AIForge Hackathon, Problem Statement 1.

> AI reads and suggests. Code checks. Humans decide.

PackProofAI turns the messy starting point of a packaging project (the current carton PDF, a content sheet, notes) into a design brief an agency can use. Every value shows where it came from. Every number is checked by code. Every gap or conflict becomes a short, ranked question for the person who owns it. Nothing is invented.

## What it does with the Esko sample pack

Upload the two files in `samples/` (Dancing Fish Granola: US carton PDF and content sheet) like any product's files, and PackProofAI:

- Reads the dieline, finds the 16 panels from the crease lines, names them from the guide labels (front/PDP, back, sides, flaps) and ignores printing-guide text such as "Art orientation" and "Copy free".
- Fills 58 brief fields, each with proof: artwork panel and position, or Excel cell plus its note.
- Finds the errors planted in the sample, plus several that are not obvious:

| Found by code | Example |
|---|---|
| Math | Sugars 18 g > carbohydrate 15 g; calories 166 vs 330 calculated; 8 x 85 g is not 480 g; 10 wrong %DV figures; honey 9% makes the ingredient order impossible |
| Files disagree | Artwork prints carbohydrate **66 g** and sodium **23 mg**; content sheet says 15 g and 25 mg; ingredient lists differ |
| Claims and allergens | Vegan claim with honey and 45 mg cholesterol; "No Added Sugar" with honey and coconut sugar; "May contain" almonds that are ingredients |
| US label rules | No ounces on net weight; net weight not on the front panel; serving size without a unit; producer without an address |
| Artwork file hygiene | A **hidden EU "per 100 g" nutrition table** under the US panel (found from the PDF drawing order) |
| Spec sheet | Nutrition columns for 480 g and 1000 g are the per-serving values multiplied by pack weight |

It also shows the checks that **passed** (barcode check digit, fat breakdown, all 14 Nutrition Facts lines present), so reviewers can trust what is not flagged.

## The workflow

0. **Projects**: every brief on the server, with readiness and blocking counts. Open, search, delete, or start a new one.
1. **New brief**: choose the situation, the market and the product category, then upload the files.
   - *Refresh an existing pack*: artwork and content sheet are compared; where they disagree, someone decides which is right.
   - *Adapt to a new market*: the new market's sheet wins; differences from the old pack become designer changes.
   - *New product*: an uploaded artwork is a reference only; every item is new copy to place.
2. **Findings**: what was read and what the checks found, with evidence highlighted on the artwork.
3. **Questions**: only real decisions, grouped by owner (R&D, Legal, Supply Chain, Brand), each with "why am I asked this?" and one-click answers computed by code from your own files.
4. **Workbench**: artwork, editable brief and findings side by side. "Preview impact" shows what a change would fix or break before saving. Finalizing is refused while blocking decisions are open.
5. **Designer brief**: Keep / Change / Add / Remove / Unknown, an annotated box layout, approved copy, open questions, decisions and sources, exported as PDF or Word.

Every brief also has an **Assistant**: it answers general packaging questions, takes every statement about the product from the brief's own data with checked citations, and prepares changes that apply only when you press Apply.

## Where AI is used (and kept honest)

AI is optional. With `LLM_PROVIDER=none` the whole pipeline runs on code alone. When it is on, every AI output is validated by code before use, and AI findings are always "Needs human check" and never block a brief.

| Use | Problem it solves | Guardrail |
|---|---|---|
| Vision cross-check | Text layer differs from what is printed | Only adds an alternative value; never overwrites; low confidence dropped |
| Rule review | Fixed checks cannot cover every clause | Must cite a shown clause and quote real text; never blocking |
| Claims review | Misleading wording | Quote must exist in the cited fields |
| Question rewording | Plain language for each owner | Rewrite dropped if any number is lost; answers stay code-made |
| OCR | Images and scanned PDFs | Tesseract first; vision model second, confidence capped |
| Company rulebook import | Company-specific rules | Each rule quotes its source; only ticked rules apply |
| Export summary | One-page overview for the designer | Sentences with numbers not in the brief are dropped |
| Assistant, Talk to the Pack, Agency simulator | Fast answers, field audits, "would a studio accept this?" | Code decides scores; changes are previewed and applied only on request |

## How uncertainty is handled

- **Three field states**: Confirmed (sources agree, checks pass, or a reviewer approved it), Needs review (conflict, doubtful or assumed), Missing (no source has it).
- **Honest issue labels**: Definite error / Likely problem / Needs human check, and Blocking / Warning / Info.
- **Never invented**: a value only comes from a file or a person.
- **Code beats AI on anything calculable.**
- **Limits are shown**: logos, seals and barcode digits are images, so the app says it could not read them.
- **Everything is logged**: who changed what, old and new value, and why.

## Architecture

```
Next.js 14 (TypeScript, Tailwind)        7 screens, artwork viewer with evidence boxes
        |  /api (proxied by next.config.mjs)
FastAPI (Python)
  |- Readers        PyMuPDF: text with positions, page renders, dieline grid, hidden-text detection
  |                 openpyxl: label/value/note groups, highlighted cells, nutrition tables
  |- Extract+merge  rules turn fragments into candidates with proof; sources compared field by field
  |- Checks         plain Python: math, claims, allergens, artwork hygiene, and label rules from
  |                 rule packs per market and category (US, EU, India; food, cosmetics, medicines, ...)
  |- Questions      ranked, merged per field, answers re-run all checks
  |- AI (optional)  vision, OCR, rule and claims review, question wording, rulebook import,
  |                 assistant and export summary; every output validated by code
  |- Designer brief Keep / Change / Add / Remove / Unknown, PDF + DOCX export
  '- Sessions       JSON on disk per brief (backend/uploads/<id>/)
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

### Docker

```bash
docker compose up --build        # web app http://localhost:3100, API http://localhost:8100/docs
```

The backend image includes Tesseract for OCR. `backend/.env` is used when present.

### Deploy on Render

`render.yaml` defines both services. In Render choose **New > Blueprint**, pick this repository, and fill in the AI keys. Deploy `packproofai-api` first, then set `BACKEND_URL` on `packproofai-web` to its public URL (for example `https://packproofai-api.onrender.com`). `BACKEND_URL` is read when the web app builds, so redeploy the web app after changing it.

Briefs are stored on the service's disk, which Render clears on every deploy. To keep them, add a persistent disk mounted at `/var/data` and set `UPLOAD_DIR=/var/data/uploads` and `EXPORT_DIR=/var/data/exports`.

### Tests

```bash
cd backend
venv\Scripts\python -m pytest -q
```

164 tests pass (about 6 minutes, offline, AI disabled). `backend/tests/expected_findings.json` lists every planted error and the check that must catch it, plus things that must **not** be flagged. The suite also runs on a changed copy of the content sheet and walks the API flow end to end (answer, re-check, finalize gate, export).

Frontend checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### AI provider (optional)

Copy `backend/.env.example` to `backend/.env` and fill in only what you use. Never commit `.env`.

```bash
# Google AI Studio
LLM_PROVIDER=gemini
LLM_API_KEY=...
LLM_MODEL=gemini-3.8-flash

# or any OpenAI-compatible API (Groq, OpenRouter, a local Ollama, ...)
LLM_PROVIDER=openai_compatible
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=...
LLM_MODEL=<a model your provider offers>
```

Each role (vision, ocr, rules, claims, questions, chat) can use its own provider and key; see `.env.example`. With AI on, rendered artwork pages and brief text are sent to the provider; use a local model (Ollama) for confidential packaging.

## Project layout

```
backend/app/
  services/file_parser.py     readers (PDF, Excel, Word, notes, images)
  services/extract_fields.py  fragments -> candidate values with proof
  services/merge.py           combine sources into brief fields
  services/checks/            sources, nutrition, claims, market rules
  services/questions.py       question engine
  services/pipeline.py        analyze, recompute, readiness
  services/autopilot.py       build pipeline with a live trace
  services/ai_*.py, llm.py    optional AI, validated by code
  services/designer.py        designer brief
  services/guidelines.py      rule packs (backend/app/guidelines/*.json)
  routers/                    sessions, review, export, chat, pack, standards
frontend/src/
  app/                        landing, projects, upload, analysis, questions, review, export
  components/                 artwork viewer, issues, brief editor, designer brief, assistant
samples/                      Esko sample files
```

## Known limits

- The AI steps have not been measured against a live provider; the test suite runs with AI off.
- Storage is JSON on disk with no login. A shared deployment needs authentication and cleanup of old uploads.
- Rule packs marked Draft should be reviewed by a regulatory expert before real use.
