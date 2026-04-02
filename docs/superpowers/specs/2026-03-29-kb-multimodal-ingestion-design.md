# KB Multimodal Ingestion Pipeline — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Author:** Guillermo + Claude

## Problem

The current KB ingestion pipeline embeds PDF pages and images as vectors but does not extract or store their text content. When the KB Chat retrieves these chunks, it only gets metadata like `[PDF: Preflight Document — page 7/7]` instead of the actual text. This makes the conversational assistant unable to answer questions about document content.

Additionally, HTML email code and Word documents (.doc/.docx) are not supported as upload types.

## Solution

Use Gemini Vision (`generateContent`) during ingestion to extract text from all document types. Store the extracted text in `knowledge_chunks.content` so the RAG pipeline returns real content at query time.

## Supported File Types

| Type | Extension | Extraction Method | Content Stored |
|------|-----------|-------------------|----------------|
| PDF (native) | .pdf | Gemini Vision per page | Extracted text per page |
| PDF (scanned) | .pdf | Gemini Vision OCR per page | OCR'd text per page |
| Image | .png, .jpg, .webp, .gif | Gemini Vision description | Auto-generated description |
| HTML Email | .html | Parse HTML → plain text + source | Clean text in `content`, raw HTML in `metadata.html_source` |
| Word | .doc, .docx | Gemini Vision (upload as binary) | Extracted text, chunked normally |

## Ingestion Flow (per file type)

### PDFs (.pdf)
1. Split into individual pages (existing logic via pdf-lib)
2. For each page: convert to base64 image
3. Call `gemini.models.generateContent()` with the page image + prompt: "Extract all text from this document page. Return only the text, preserving structure."
4. Store extracted text in `knowledge_chunks.content`
5. Embed the extracted text (not the image) for better semantic search
6. Keep `media_type: 'pdf_page'` and `file_path` for linking to original

### Images (.png, .jpg, .webp, .gif)
1. Call `gemini.models.generateContent()` with image + prompt: "Describe this image in detail. If it contains text, extract all text. If it's an email screenshot, describe the email design and extract all visible copy."
2. Store description in `knowledge_chunks.content`
3. Store description also in `metadata.image_description`
4. Embed the description text for semantic search
5. Keep `media_type: 'image'` and `file_path` for inline display

### HTML Emails (.html)
1. Read file content as UTF-8 string
2. Extract plain text by stripping HTML tags (regex-based, no new deps)
3. Store plain text in `knowledge_chunks.content`
4. Store raw HTML in `metadata.html_source`
5. Chunk the plain text normally (500 tokens, 50 overlap)
6. Embed the plain text chunks
7. Set `media_type: 'html_email'`, `content_type: 'html'`

### Word Documents (.doc, .docx)
1. Read file as base64
2. Call `gemini.models.generateContent()` with the file + prompt: "Extract all text from this document. Preserve headings, lists, and structure."
3. Chunk the extracted text normally (500 tokens, 50 overlap)
4. Embed text chunks
5. Set `media_type: 'text'`, `content_type: 'document'`

## Schema Changes

No new columns. Changes to existing fields:

- **`knowledge_chunks.content`**: Now stores real extracted text instead of `[PDF: title — page N]`
- **`knowledge_chunks.metadata`** (JSONB): New optional fields:
  - `html_source` (string): Raw HTML for email chunks
  - `image_description` (string): Gemini-generated description for images
  - `extraction_method` (string): `'gemini-vision'` | `'html-parse'` | `'text-chunk'`
- **`knowledge_documents.content_type`**: Add new values: `'html'`, `'document'`

## Upload Endpoint Changes

**File:** `apps/dashboard/server.js` — `POST /api/knowledge/upload`

- Add `.html`, `.doc`, `.docx` to allowed file types
- Add MIME types: `text/html`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Max file size stays at 20MB
- Route to appropriate ingestion function based on extension

## Gemini Helper Functions (new)

**File:** `packages/core/ai-providers/gemini.js`

- `extractTextFromImage(base64, mimeType)` — sends image to Gemini, returns extracted/described text
- `extractTextFromPdf(base64)` — sends PDF page to Gemini, returns extracted text
- `extractTextFromDocument(base64, mimeType)` — sends Word doc to Gemini, returns extracted text

All three use `gemini.models.generateContent()` with `gemini-2.0-flash` (fast, cheap, good at OCR).

## KB Chat Rendering (frontend)

**File:** `apps/dashboard/src/components/KBChat.jsx`

When the assistant response includes content from HTML email chunks:
- The backend includes `html_source` in RAG results when available
- The chat renders an email preview card:
  - Rendered HTML in a sandboxed iframe (reuse pattern from `EmailProposalViewer.jsx`)
  - Toggle button to show/copy raw HTML code
  - If an image chunk is also found for the same email, show it inline

For images: already handled by the markdown renderer (`![alt](/api/kb-files/path)`)

For PDFs and Word docs: the extracted text is shown conversationally by the AI, with a link to the original file.

## System Prompt Update

The KB Chat system prompt already instructs the model to cite sources and use markdown for images/links. No changes needed — the improvement comes from the RAG context now containing real text instead of metadata stubs.

## Test Plan

1. Delete the existing Preflight Document from KB
2. Upload `docs/Preflight+_+Experience.doc` via the new pipeline
3. Ask "seedlist de preflight" → should return actual text content from the document
4. Upload a campaign email screenshot (image) → ask about it → should show image inline with description
5. Upload an HTML email file → ask about it → should show preview + code
6. Verify Overview tab stats update correctly
7. Verify existing text document ingestion still works

## Out of Scope

- Marketing Cloud API integration (future)
- Video/audio ingestion (future)
- Bulk re-ingestion endpoint (not needed — delete and re-upload)
