# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the brand manager.** A brand or packaging manager at a consumer-goods company who is launching or changing a product and must send a clear packaging brief to a design agency. They arrive with scattered, partly wrong information (an old packaging PDF, a content sheet, notes) and need to know what is right, what is missing and who must decide what, before the agency starts.
- **Recipients: the design agency.** Designers receive the finished brief. They need to know what to keep, change, add and remove on each panel, and which questions are still open; they do not need every field repeated.
- **Evaluators: Esko AIForge hackathon judges.** They assess a working prototype through a 3–5 minute recorded demo and, if shortlisted, a 10-minute live demo plus 5 minutes of questions. They score usefulness of AI, handling of uncertainty and wrong AI output, simplicity of the interface, and whether it actually works.

## Product Purpose

PackProofAI turns a messy starting point (packaging artwork PDF, Excel content sheet, Word or text notes) into a structured, trustworthy design brief. It reads every file, fills a standard brief with proof for each value, checks the information, asks the user only the questions that matter, lets them review and edit, and produces a designer-ready brief.

Success means a brand manager can hand an agency a brief in which every value is traceable, every known error has been caught or consciously passed on as an open question, and nothing was invented.

## Positioning

Other tools summarise files; PackProofAI checks them. All four of these are core and must be protected together:

1. **Checks, not summaries.** Deterministic code verifies math, claims, allergens and market rules, so errors in the source files are caught instead of copied into the brief.
2. **Proof for every value.** Each value links to its exact source: a position on a named artwork panel, or an Excel cell and its note.
3. **Designer-ready output.** The brief is organised as Keep / Change / Add / Remove / Unknown per panel, with approved copy and open questions, not as a data dump.
4. **Honest uncertainty.** Findings are labelled Definite error, Likely problem or Needs human check. Missing values stay missing. AI findings are always "needs human check" and never block on their own.

## Operating Context

- Workflow: Upload (choose situation: update existing pack, adapt to a new market, or new product; choose market) → Findings → Questions → Workbench (review, edit, finalize) → Designer brief (PDF/DOCX export).
- Inputs: carton or label dieline PDFs containing printing-guide marks; Excel content sheets with value, note and highlighted-cell conventions; Word documents; plain-text notes.
- Questions are routed to the people who can answer them: R&D, Legal, Supply Chain, Brand, Agency.
- Finalizing is gated: blocking decisions must be answered or explicitly passed to the agency as open questions. Designer tasks never block.
- Every edit, answer and acknowledgement is logged with old value, new value and reason.

## Capabilities and Constraints

- Existing implementation: Next.js 14 (TypeScript, Tailwind) frontend; FastAPI (Python) backend; PyMuPDF, openpyxl, python-docx; DOCX/PDF export; sessions stored as JSON on disk.
- Reads dieline panels from crease lines and guide labels, filters printing-guide text, and detects text hidden under later artwork.
- About 30 deterministic checks (nutrition math, %DV, serving math, ingredient order, claims vs ingredients, allergen wording, US label rules, barcode check digit, artwork leftovers).
- Change Impact Simulator: previews what an edit would resolve or introduce, and where else the old value appears, before saving.
- Optional AI through a provider-neutral layer (Gemini or any OpenAI-compatible API such as Groq, set per job): vision cross-check of printed values, OCR of scans, rule and claims review, plain-language question wording, company-rulebook import, the assistant, and the export summary. All AI output is validated by code. The product must work fully with AI switched off.
- Label rules come from draft rule packs for the US, the EU (and FR, DE, ES, IT, NL) and India, per product category (food, pet food, cosmetics, medicines, medical devices, household). Retail and industrial goods run on general checks only. The packs cite their sources but are drafts that need Legal review.
- The three situations behave differently: a pack refresh compares artwork and sheet; a new-market adaptation lets the new market's sheet win and checks carried-over copy; a new product treats any artwork as a reference only.
- Terminology: field statuses are Confirmed / Needs review / Missing; issue severities are Blocking / Warning / Info; issue kinds are Definite error / Likely problem / Needs human check; design actions are Keep / Change / Add / Remove / Unknown.
- Undecided: product name and tagline are current but not confirmed as binding (see Brand Commitments).

## Brand Commitments

- Current name "PackProofAI" and line "AI reads and suggests. Code checks. Humans decide." are in use but **not confirmed as fixed**; they may change.
- **No Esko endorsement.** Esko is the hackathon host only. Never imply that Esko built, uses, sells or endorses PackProofAI, and do not use Esko branding as PackProofAI's own.

## Evidence on Hand

- Esko-provided sample files in `samples/`: `DancingFish_Granola_Berry_US_Carton.pdf` and `DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx`. These are the only real evidence.
- `backend/tests/expected_findings.json`: the planted errors in the sample and the check that catches each; the backend test suite (115 tests) proves them.
- **Must not be fabricated:** customers, testimonials, usage numbers, accuracy percentages, time-saved claims, pricing, deployments or partnerships.

## Product Principles

1. **Never invent.** A value comes from a file or a person; otherwise it is shown as missing.
2. **Show the proof.** Any value or finding should be traceable to its source in one click.
3. **Code decides what can be calculated.** AI reads and suggests; it never overrides arithmetic or blocks on its own.
4. **Ask only what matters, to the right person.** Questions are ranked, explained ("why am I asked this?"), and routed by owner.
5. **Humans have the last word.** Every decision is reversible, logged, and either resolved or passed on openly.

## Accessibility & Inclusion

WCAG 2.2 AA is a requirement for the app, including colour contrast, keyboard operation and focus visibility. Field statuses and severities must never rely on colour alone.
