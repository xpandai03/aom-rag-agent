/**
 * Text Processing Utilities
 *
 * Handles HTML cleaning, text chunking, and token estimation
 * for the RAG data ingestion pipeline.
 */

import fs from "fs";
import path from "path";
import os from "os";

/**
 * Extract text content from PDF buffer
 *
 * @param buffer - PDF file buffer
 * @returns Extracted text content
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  let tempFilePath: string | null = null;

  try {
    // Write buffer to temporary file (workaround for pdf-parse)
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
    fs.writeFileSync(tempFilePath, buffer);

    // Use dynamic import for pdf-parse v1.1.1
    const pdfParse = (await import("pdf-parse")).default;
    const dataBuffer = fs.readFileSync(tempFilePath);
    const data = await pdfParse(dataBuffer);

    return data.text;
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${(error as Error).message}`);
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

/**
 * Clean HTML content and extract plain text
 * Removes all HTML tags, scripts, styles, and normalizes whitespace
 */
export function cleanHTML(html: string): string {
  if (!html) return "";

  // Remove script and style tags with their content
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = decodeHTMLEntities(text);

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Remove excessive newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text;
}

/**
 * Decode common HTML entities
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&mdash;": "—",
    "&ndash;": "–",
    "&hellip;": "...",
    "&rsquo;": "'",
    "&lsquo;": "'",
    "&rdquo;": '"',
    "&ldquo;": '"',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, "g"), char);
  }

  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, num) =>
    String.fromCharCode(parseInt(num, 10))
  );

  return decoded;
}

/**
 * Estimate token count for text
 * Rough approximation: 1 token ≈ 4 characters for English text
 * This is a conservative estimate for GPT-style tokenization
 */
export function estimateTokens(text: string): number {
  // Average characters per token in English is ~4
  // We use 3.5 to be conservative (more tokens = better chunking)
  return Math.ceil(text.length / 3.5);
}

/**
 * Chunk Configuration
 */
export interface ChunkConfig {
  maxTokens?: number;      // Max tokens per chunk (default: 800)
  overlap?: number;         // Overlap in tokens (default: 200)
  preserveSentences?: boolean;  // Try to break at sentence boundaries (default: true)
}

/**
 * Chunk text into smaller segments with overlap
 *
 * @param text - The text to chunk
 * @param config - Chunking configuration
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  config: ChunkConfig = {}
): string[] {
  const {
    maxTokens = 800,
    overlap = 200,
    preserveSentences = true,
  } = config;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const estimatedTokens = estimateTokens(text);

  // If text is short enough, return as single chunk
  if (estimatedTokens <= maxTokens) {
    return [text];
  }

  const chunks: string[] = [];

  if (preserveSentences) {
    // Split into sentences
    const sentences = splitIntoSentences(text);
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = estimateTokens(sentence);

      // If single sentence exceeds max, split it by words
      if (sentenceTokens > maxTokens) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(" "));
          currentChunk = [];
          currentTokens = 0;
        }
        // Split long sentence by words
        const wordChunks = chunkByWords(sentence, maxTokens, overlap);
        chunks.push(...wordChunks);
        continue;
      }

      // If adding this sentence exceeds max, save current chunk
      if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));

        // Create overlap by keeping last few sentences
        const overlapSentences = getOverlapSentences(currentChunk, overlap);
        currentChunk = overlapSentences;
        currentTokens = estimateTokens(currentChunk.join(" "));
      }

      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));
    }
  } else {
    // Simple word-based chunking
    chunks.push(...chunkByWords(text, maxTokens, overlap));
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Match sentence endings (.!?) followed by space or end of string
  // Avoid splitting on abbreviations like "Mr.", "Dr.", etc.
  const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])/g;
  return text.split(sentenceRegex).map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Chunk text by words when sentence-based chunking isn't suitable
 */
function chunkByWords(
  text: string,
  maxTokens: number,
  overlap: number
): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  // Approximate words per token (English: ~0.75 words per token)
  const wordsPerToken = 0.75;
  const maxWords = Math.floor(maxTokens * wordsPerToken);
  const overlapWords = Math.floor(overlap * wordsPerToken);

  for (let i = 0; i < words.length; i += (maxWords - overlapWords)) {
    const chunk = words.slice(i, i + maxWords).join(" ");
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * Get last few sentences that fit within overlap token count
 */
function getOverlapSentences(sentences: string[], overlapTokens: number): string[] {
  const overlap: string[] = [];
  let tokens = 0;

  // Add sentences from the end until we reach overlap limit
  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentenceTokens = estimateTokens(sentences[i]);
    if (tokens + sentenceTokens > overlapTokens) {
      break;
    }
    overlap.unshift(sentences[i]);
    tokens += sentenceTokens;
  }

  return overlap;
}

/**
 * Prepare article for embedding
 * Combines title and content with metadata
 */
export interface PreparedArticle {
  id: string;
  title: string;
  url: string;
  content: string;
  chunks: string[];
  totalTokens: number;
}

export function prepareArticle(
  id: string,
  title: string,
  url: string,
  htmlContent: string,
  chunkConfig?: ChunkConfig
): PreparedArticle {
  // Clean HTML
  const cleanedContent = cleanHTML(htmlContent);

  // Combine title and content for better context
  const fullText = `${title}\n\n${cleanedContent}`;

  // Chunk the text
  const chunks = chunkText(fullText, chunkConfig);

  // Estimate total tokens
  const totalTokens = estimateTokens(fullText);

  return {
    id,
    title,
    url,
    content: cleanedContent,
    chunks,
    totalTokens,
  };
}

/**
 * Batch prepare multiple articles
 */
export function batchPrepareArticles(
  articles: Array<{
    id: string;
    title: string;
    url: string;
    content: string;
  }>,
  chunkConfig?: ChunkConfig
): PreparedArticle[] {
  return articles.map((article) =>
    prepareArticle(
      article.id,
      article.title,
      article.url,
      article.content,
      chunkConfig
    )
  );
}
