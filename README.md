# 🏭 BriefForge

**AI-powered packaging design brief generator**

> *AI reads and suggests. Code checks. Humans decide.*

BriefForge is an intelligent assistant that transforms messy, scattered product information (PDFs, Excel spreadsheets, Word documents, images) into clear, structured packaging design briefs that design agencies can actually use.

## 🎯 What It Does

1. **📄 Read** — Extracts text, tables, and images from uploaded documents (PDF, Excel, Word, images)
2. **🔍 Understand** — Identifies which panel each text belongs to (front, back, side, top) and filters out print guide marks
3. **📝 Fill** — Populates a standard brief form with source provenance for every value
4. **✅ Check** — Validates data using deterministic math checks AND AI-powered rule checks
5. **❓ Ask** — Generates smart follow-up questions only for missing or conflicting information
6. **✏️ Review** — Lets users edit every field, see where data came from, and approve changes
7. **🔒 Finalize** — Blocks finalization until critical issues are resolved or acknowledged
8. **📤 Output** — Generates a designer-friendly brief (PDF/DOCX) with proof tables

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Frontend                       │
│        (TypeScript + Tailwind CSS + shadcn/ui)          │
│                                                          │
│  Upload → Analysis → Questions → Review → Export         │
│  (Dashboard layout with sidebar navigation)              │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────┐
│                  FastAPI Backend                         │
│                    (Python)                              │
│                                                          │
│  File Parser → AI Engine → Checker → Brief Builder       │
│  (PyMuPDF)    (Gemini)   (Rules)   (Structured)         │
│                                                          │
│  → Brief Exporter (DOCX/PDF)                            │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14, TypeScript, React |
| Styling | Tailwind CSS, shadcn/ui |
| State Management | Zustand |
| Backend | FastAPI, Python 3.11+ |
| AI | Google Gemini API (gemini-2.0-flash) |
| File Parsing | PyMuPDF, openpyxl, python-docx, Pillow |
| Export | python-docx, ReportLab |
| Session Storage | In-memory (hackathon scope) |

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Google Gemini API Key** ([Get one here](https://aistudio.google.com/apikey))

### 1. Clone & Setup

```bash
git clone <repo-url>
cd briefforge
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure API key
copy .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run the server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run the dev server
npm run dev
```

### 4. Open the App

Navigate to [http://localhost:3000](http://localhost:3000)

## 📋 Validation Checks

BriefForge performs both **deterministic** (code-based) and **AI-powered** checks:

### Deterministic Checks (No AI)
- ✅ Total sugars ≤ total carbohydrates
- ✅ Servings × serving size = total weight
- ✅ Calorie calculation: (fat×9) + (carbs×4) + (protein×4)
- ✅ %Daily Value calculations against FDA reference values
- ✅ Vegan claim → zero cholesterol, no animal ingredients
- ✅ Trans fat ≤ total fat
- ✅ Realistic protein/serving for product type

### AI-Powered Checks
- 🤖 Claims vs. certifications consistency
- 🤖 Product type vs. nutritional plausibility
- 🤖 Cross-source conflict detection (PDF vs Excel)
- 🤖 Completeness check against country-specific requirements

## 📁 Project Structure

```
briefforge/
├── frontend/               # Next.js dashboard app
│   └── src/
│       ├── app/            # Pages: upload, analysis, questions, review, export
│       ├── components/     # UI components + feature components
│       ├── lib/            # API client, types, utilities
│       └── store/          # Zustand state management
│
├── backend/                # FastAPI Python backend
│   └── app/
│       ├── routers/        # API endpoints
│       ├── services/       # Business logic (parser, AI, checker, builder, exporter)
│       ├── models/         # Pydantic data models
│       └── prompts/        # AI prompt templates
│
└── README.md
```

## 🎪 Hackathon: Esko Challenge

Built for the **Esko "From Product Idea to Design Brief"** hackathon challenge.

**Key differentiators:**
- **Provenance tracking** — every value shows its source (PDF page, Excel cell, AI inference)
- **Deterministic + AI validation** — catches math errors, logical impossibilities, and cross-source conflicts
- **Human-in-the-loop** — AI suggests, humans decide. Nothing is finalized without review.
- **Handles 3 scenarios**: existing product update, new market adaptation, brand new product

## 📄 License

MIT
