/**
 * TOOLS-015 (#51) -- PDF / text ingestion
 *
 * Stubs for ingesting PDF and plain-text documents into a structured
 * representation. The extracted text, page metadata, and table-of-contents
 * tree are returned for downstream processing (RAG, summarization,
 * search indexing, etc.).
 *
 * @module
 */

import { readFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Table of contents
// ---------------------------------------------------------------------------

/** A single entry in the document's table of contents. */
export type TocEntry = {
  /** Heading or section title. */
  title: string;

  /** Nesting level (1 = top-level heading, 2 = sub-heading, etc.). */
  level: number;

  /** 1-based page number where this heading appears (PDF only). */
  page?: number;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Extracted content for a single page (PDF) or logical section (text). */
export type IngestedPage = {
  /** 1-based page number. */
  page_number: number;

  /** Extracted plain text for this page. */
  text: string;

  /** Character count (useful for chunking heuristics). */
  char_count: number;
};

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/** Document-level metadata extracted from the file. */
export type IngestMetadata = {
  /** Document title (from PDF metadata or first heading). */
  title?: string;

  /** Author (from PDF metadata, may be absent). */
  author?: string;

  /** Creation date (from PDF metadata, ISO-8601). */
  created_at?: string;

  /** Modification date (from PDF metadata, ISO-8601). */
  modified_at?: string;

  /** PDF producer / creator application. */
  producer?: string;

  /** Total file size in bytes. */
  file_size_bytes?: number;

  /** MIME type of the source file. */
  content_type?: string;
};

// ---------------------------------------------------------------------------
// IngestResult
// ---------------------------------------------------------------------------

/** The structured result of ingesting a document. */
export type IngestResult = {
  /** The full extracted text (all pages concatenated). */
  text: string;

  /** Per-page content. */
  pages: IngestedPage[];

  /** Document metadata. */
  metadata: IngestMetadata;

  /** Table of contents extracted from headings / bookmarks. */
  table_of_contents: TocEntry[];
};

// ---------------------------------------------------------------------------
// PDF ingestion stub
// ---------------------------------------------------------------------------

/**
 * Ingest a PDF document and extract its text content, page structure,
 * metadata, and table of contents.
 *
 * This is a stub -- a real implementation would use a library such as
 * `pdf-parse`, `pdfjs-dist`, or an external service.
 *
 * @param path Absolute path to the PDF file.
 * @returns The structured ingestion result.
 */
export async function ingestPdf(path: string): Promise<IngestResult> {
  // Read the file to verify it exists and capture size.
  const data = await readFile(path);

  // TODO: parse PDF with a library (pdf-parse, pdfjs-dist, etc.)
  // TODO: extract text per page, metadata, and bookmarks/TOC

  return {
    text: "",
    pages: [],
    metadata: {
      file_size_bytes: data.byteLength,
      content_type: "application/pdf",
    },
    table_of_contents: [],
  };
}

// ---------------------------------------------------------------------------
// Plain text ingestion stub
// ---------------------------------------------------------------------------

/**
 * Ingest a plain-text document and extract its content, metadata, and
 * a heading-based table of contents.
 *
 * Headings are detected by common patterns:
 * - Markdown-style (`# Heading`, `## Sub-heading`)
 * - Underlined (`Heading\n=======`, `Sub-heading\n-------`)
 *
 * This is a stub -- heading detection and page segmentation are minimal.
 *
 * @param path Absolute path to the text file.
 * @returns The structured ingestion result.
 */
export async function ingestText(path: string): Promise<IngestResult> {
  const data = await readFile(path, "utf-8");

  // TODO: detect headings for TOC, segment into logical pages / sections
  // TODO: extract metadata from front-matter (YAML, TOML) if present

  const page: IngestedPage = {
    page_number: 1,
    text: data,
    char_count: data.length,
  };

  return {
    text: data,
    pages: [page],
    metadata: {
      file_size_bytes: Buffer.byteLength(data, "utf-8"),
      content_type: "text/plain",
    },
    table_of_contents: [],
  };
}
