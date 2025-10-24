/**
 * OpenAI Embeddings Service
 *
 * Handles embedding generation with batching, retry logic, and error handling
 */

import { OpenAI } from "openai";

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client singleton
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set in environment variables"
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Embedding model configuration
 */
export const EMBEDDING_MODEL = "text-embedding-3-large";
export const EMBEDDING_DIMENSIONS = 3072;

/**
 * Generate embedding for a single text
 *
 * @param text - The text to embed
 * @param retries - Number of retry attempts (default: 3)
 * @returns Vector embedding (3072 dimensions)
 */
export async function generateEmbedding(
  text: string,
  retries = 3
): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const client = getOpenAIClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.embeddings.create({
        input: text,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error("No embedding returned from OpenAI API");
      }

      return embedding;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on invalid request errors
      if (error instanceof Error && error.message.includes("invalid")) {
        throw error;
      }

      // Exponential backoff for rate limits
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(
          `Embedding attempt ${attempt + 1} failed, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to generate embedding after ${retries} retries: ${lastError?.message}`
  );
}

/**
 * Batch embedding configuration
 */
export interface BatchEmbeddingOptions {
  batchSize?: number;         // Max texts per batch (default: 100)
  concurrency?: number;       // Max concurrent requests (default: 5)
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Generate embeddings for multiple texts in batches
 *
 * @param texts - Array of texts to embed
 * @param options - Batching options
 * @returns Array of embeddings in the same order as input texts
 */
export async function batchGenerateEmbeddings(
  texts: string[],
  options: BatchEmbeddingOptions = {}
): Promise<number[][]> {
  const {
    batchSize = 100,
    concurrency = 5,
    onProgress,
  } = options;

  if (texts.length === 0) {
    return [];
  }

  // Filter out empty texts and keep track of indices
  const validTexts: Array<{ index: number; text: string }> = [];
  texts.forEach((text, index) => {
    if (text && text.trim().length > 0) {
      validTexts.push({ index, text });
    }
  });

  // Split into batches
  const batches: Array<Array<{ index: number; text: string }>> = [];
  for (let i = 0; i < validTexts.length; i += batchSize) {
    batches.push(validTexts.slice(i, i + batchSize));
  }

  const allEmbeddings: Array<{ index: number; embedding: number[] }> = [];
  let completed = 0;

  // Process batches with concurrency control
  for (let i = 0; i < batches.length; i += concurrency) {
    const batchGroup = batches.slice(i, i + concurrency);

    const batchPromises = batchGroup.map(async (batch) => {
      try {
        const client = getOpenAIClient();
        const response = await client.embeddings.create({
          input: batch.map((item) => item.text),
          model: EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
        });

        return batch.map((item, idx) => ({
          index: item.index,
          embedding: response.data[idx].embedding,
        }));
      } catch (error) {
        console.error(`Batch embedding failed:`, error);
        // Retry individual embeddings if batch fails
        const individualEmbeddings = await Promise.all(
          batch.map(async (item) => ({
            index: item.index,
            embedding: await generateEmbedding(item.text),
          }))
        );
        return individualEmbeddings;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach((results) => allEmbeddings.push(...results));

    completed += batchGroup.reduce((sum, batch) => sum + batch.length, 0);
    if (onProgress) {
      onProgress(completed, validTexts.length);
    }
  }

  // Sort by original index and extract embeddings
  allEmbeddings.sort((a, b) => a.index - b.index);
  return allEmbeddings.map((item) => item.embedding);
}

/**
 * Generate embedding for a query
 * This is a convenience wrapper around generateEmbedding
 */
export async function embedQuery(query: string): Promise<number[]> {
  return generateEmbedding(query);
}

/**
 * Calculate cosine similarity between two embeddings
 * Useful for testing and validation
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have the same dimensions");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Estimate cost for embedding generation
 * text-embedding-3-large: $0.00013 per 1K tokens
 */
export function estimateEmbeddingCost(totalTokens: number): number {
  const costPerKTokens = 0.00013;
  return (totalTokens / 1000) * costPerKTokens;
}
