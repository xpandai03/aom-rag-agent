/**
 * Long Document Summarization Pipeline
 *
 * Handles summarization of long chat messages and documents that exceed
 * embedding model token limits (8192 tokens for text-embedding-3-large).
 *
 * STRATEGY:
 * - For messages >6k tokens: Summarize to preserve key themes
 * - For messages >20k tokens: Two-stage summarization (chunk → condense)
 * - Preserves question/intent while condensing context
 *
 * COST: ~$0.002 per summarization (GPT-4o-mini)
 */

import OpenAI from "openai";
import { estimateTokens, chunkText } from "./text-processing";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Summarize a long chat message for embedding generation
 *
 * @param message - The user's message (potentially very long)
 * @param maxOutputTokens - Maximum tokens for the summary (default: 2000)
 * @returns Summarized version suitable for embedding
 */
export async function summarizeChatMessage(
  message: string,
  maxOutputTokens: number = 2000
): Promise<{ summary: string; originalTokens: number; summaryTokens: number }> {
  const originalTokens = estimateTokens(message);

  // If message is short enough, return as-is
  if (originalTokens <= 6000) {
    return {
      summary: message,
      originalTokens,
      summaryTokens: originalTokens,
    };
  }

  console.log(`📝 Summarizing long message: ${originalTokens.toLocaleString()} tokens`);

  try {
    // For very long messages (>20k tokens), use two-stage summarization
    if (originalTokens > 20000) {
      return await twoStageSummarization(message, maxOutputTokens);
    }

    // For moderately long messages (6k-20k tokens), single-pass summarization
    const summary = await summarizeText(message, maxOutputTokens);
    const summaryTokens = estimateTokens(summary);

    console.log(`✅ Summarized: ${originalTokens.toLocaleString()} → ${summaryTokens.toLocaleString()} tokens`);

    return {
      summary,
      originalTokens,
      summaryTokens,
    };
  } catch (error) {
    console.error("Summarization failed, using truncation fallback:", error);
    // Fallback: truncate to safe size
    const truncated = truncateToTokenLimit(message, 6000);
    return {
      summary: truncated,
      originalTokens,
      summaryTokens: estimateTokens(truncated),
    };
  }
}

/**
 * Two-stage summarization for very long documents
 * Stage 1: Chunk and summarize each chunk
 * Stage 2: Condense all summaries into final summary
 */
async function twoStageSummarization(
  text: string,
  maxOutputTokens: number
): Promise<{ summary: string; originalTokens: number; summaryTokens: number }> {
  const originalTokens = estimateTokens(text);

  console.log(`📊 Two-stage summarization for ${originalTokens.toLocaleString()} tokens`);

  // Stage 1: Chunk into ~6k token segments and summarize each
  const chunks = chunkText(text, {
    maxTokens: 6000,
    overlap: 200,
    preserveSentences: true,
  });

  console.log(`  Stage 1: Summarizing ${chunks.length} chunks...`);

  const chunkSummaries = await Promise.all(
    chunks.map(async (chunk) => {
      return await summarizeText(chunk, 500);
    })
  );

  // Stage 2: Merge summaries and condense
  const mergedSummaries = chunkSummaries.join("\n\n");
  console.log(`  Stage 2: Condensing merged summaries...`);

  const finalSummary = await summarizeText(mergedSummaries, maxOutputTokens);
  const summaryTokens = estimateTokens(finalSummary);

  console.log(`✅ Two-stage complete: ${originalTokens.toLocaleString()} → ${summaryTokens.toLocaleString()} tokens`);

  return {
    summary: finalSummary,
    originalTokens,
    summaryTokens,
  };
}

/**
 * Summarize text using GPT-4o-mini
 */
async function summarizeText(text: string, maxTokens: number): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a summarization assistant. Extract the key themes, topics, questions, and important details from the text. Preserve:
- Main topics and subjects discussed
- Questions or requests from the user
- Names, concepts, and key terms
- Overall intent and context

Be concise but comprehensive. Focus on preserving meaning for semantic search.`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  });

  return response.choices[0].message.content || text;
}

/**
 * Truncate text to token limit (fallback if summarization fails)
 */
function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Estimate characters per token (conservative: 3.5 chars/token)
  const maxChars = Math.floor(maxTokens * 3.5);
  const truncated = text.slice(0, maxChars);

  // Try to cut at sentence boundary
  const lastPeriod = truncated.lastIndexOf(".");
  if (lastPeriod > maxChars * 0.8) {
    return truncated.slice(0, lastPeriod + 1);
  }

  return truncated + "...";
}

/**
 * Summarize a long document for upload/ingestion
 * (Different from chat messages - preserves more structure)
 */
export async function summarizeLongDocument(
  text: string,
  options: { maxTokens?: number } = {}
): Promise<{ summary: string; originalTokens: number; summaryTokens: number }> {
  const maxTokens = options.maxTokens || 10000;
  const originalTokens = estimateTokens(text);

  if (originalTokens <= maxTokens) {
    return { summary: text, originalTokens, summaryTokens: originalTokens };
  }

  console.log(`📄 Summarizing document: ${originalTokens.toLocaleString()} tokens`);

  // Use two-stage for very long documents
  if (originalTokens > 20000) {
    return await twoStageSummarization(text, maxTokens);
  }

  // Single-pass for moderately long documents
  const summary = await summarizeText(text, maxTokens);
  const summaryTokens = estimateTokens(summary);

  console.log(`✅ Document summarized: ${originalTokens.toLocaleString()} → ${summaryTokens.toLocaleString()} tokens`);

  return {
    summary,
    originalTokens,
    summaryTokens,
  };
}
