# PackProofAI API with Tesseract OCR. Build from this folder: docker build -t packproofai-api .
FROM python:3.13-slim

# Tesseract program plus English data. Add more languages as tesseract-ocr-<code> (e.g. fra, deu) and set OCR_LANG.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OCR_ENGINE=auto

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Render sets PORT; 8000 is the local default.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
