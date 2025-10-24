/**
 * Pinecone Vector Database Client
 *
 * Handles all Pinecone operations: index creation, upserting vectors, querying
 */

import { Pinecone, Index } from "@pinecone-database/pinecone";
import { EMBEDDING_DIMENSIONS } from "./embeddings";

// Singleton Pinecone client
let pineconeClient: Pinecone | null = null;

/**
 * Get or create Pinecone client singleton
 */
export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not set in environment variables");
    }

    pineconeClient = new Pinecone({
      apiKey,
    });
  }

  return pineconeClient;
}

/**
 * Get the configured index name from environment
 */
export function getIndexName(): string {
  return process.env.PINECONE_INDEX_NAME || "wordpress-archive";
}

/**
 * Chunk metadata stored with each vector
 */
export interface ChunkMetadata {
  title: string;          // Article title
  url: string;            // Article URL
  content: string;        // Chunk text content
  chunkIndex: number;     // Position in original article
  articleId: string;      // Original article ID
  [key: string]: string | number;  // Allow any additional metadata
}

/**
 * Check if Pinecone index exists
 */
export async function indexExists(indexName?: string): Promise<boolean> {
  try {
    const client = getPineconeClient();
    const name = indexName || getIndexName();
    const indexes = await client.listIndexes();
    return indexes.indexes?.some((index) => index.name === name) || false;
  } catch (error) {
    console.error("Error checking if index exists:", error);
    return false;
  }
}

/**
 * Create Pinecone index with proper configuration
 */
export async function createIndex(indexName?: string): Promise<void> {
  const client = getPineconeClient();
  const name = indexName || getIndexName();

  // Check if index already exists
  const exists = await indexExists(name);
  if (exists) {
    console.log(`Index "${name}" already exists`);
    return;
  }

  console.log(`Creating index "${name}"...`);

  await client.createIndex({
    name,
    dimension: EMBEDDING_DIMENSIONS,
    metric: "cosine",
    spec: {
      serverless: {
        cloud: "aws",
        region: "us-east-1",
      },
    },
  });

  // Wait for index to be ready
  console.log("Waiting for index to be ready...");
  await waitForIndexReady(name);

  console.log(`Index "${name}" created successfully`);
}

/**
 * Wait for index to be ready
 */
async function waitForIndexReady(
  indexName: string,
  maxWaitMs = 60000
): Promise<void> {
  const client = getPineconeClient();
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const description = await client.describeIndex(indexName);
      if (description.status?.ready) {
        return;
      }
    } catch (error) {
      // Index might not be queryable yet
    }

    // Wait 2 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Index did not become ready within ${maxWaitMs}ms`);
}

/**
 * Get Pinecone index
 */
export function getIndex(indexName?: string): Index<ChunkMetadata> {
  const client = getPineconeClient();
  const name = indexName || getIndexName();
  return client.index<ChunkMetadata>(name);
}

/**
 * Vector record for upserting
 */
export interface VectorRecord {
  id: string;
  values: number[];
  metadata: ChunkMetadata;
}

/**
 * Upsert vectors to Pinecone in batches
 *
 * @param vectors - Array of vector records
 * @param batchSize - Number of vectors per batch (default: 100)
 * @param onProgress - Progress callback
 */
export async function upsertVectors(
  vectors: VectorRecord[],
  options: {
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
    indexName?: string;
  } = {}
): Promise<void> {
  const { batchSize = 100, onProgress, indexName } = options;

  if (vectors.length === 0) {
    return;
  }

  const index = getIndex(indexName);
  let completed = 0;

  // Split into batches
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);

    try {
      await index.upsert(batch);
      completed += batch.length;

      if (onProgress) {
        onProgress(completed, vectors.length);
      }
    } catch (error) {
      console.error(`Failed to upsert batch starting at index ${i}:`, error);
      throw error;
    }
  }

  console.log(`Successfully upserted ${completed} vectors`);
}

/**
 * Query result from Pinecone
 */
export interface QueryResult {
  id: string;
  score: number;
  metadata: ChunkMetadata;
}

/**
 * Query options
 */
export interface QueryOptions {
  topK?: number;                    // Number of results (default: 5)
  filter?: Record<string, any>;     // Metadata filters
  includeMetadata?: boolean;        // Include metadata (default: true)
  indexName?: string;               // Index to query
}

/**
 * Query Pinecone for similar vectors
 *
 * @param queryVector - The query embedding
 * @param options - Query options
 * @returns Array of matching results
 */
export async function queryVectors(
  queryVector: number[],
  options: QueryOptions = {}
): Promise<QueryResult[]> {
  const {
    topK = 5,
    filter,
    includeMetadata = true,
    indexName,
  } = options;

  const index = getIndex(indexName);

  try {
    const queryResponse = await index.query({
      vector: queryVector,
      topK,
      filter,
      includeMetadata,
    });

    return (queryResponse.matches || []).map((match) => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata as ChunkMetadata,
    }));
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    throw new Error(`Failed to query vectors: ${(error as Error).message}`);
  }
}

/**
 * Delete vectors by ID
 */
export async function deleteVectors(
  ids: string[],
  indexName?: string
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const index = getIndex(indexName);

  try {
    await index.deleteMany(ids);
    console.log(`Deleted ${ids.length} vectors`);
  } catch (error) {
    console.error("Error deleting vectors:", error);
    throw error;
  }
}

/**
 * Delete all vectors in the index (use with caution!)
 */
export async function deleteAll(indexName?: string): Promise<void> {
  const index = getIndex(indexName);

  try {
    await index.deleteAll();
    console.log("Deleted all vectors from index");
  } catch (error) {
    console.error("Error deleting all vectors:", error);
    throw error;
  }
}

/**
 * Get index statistics
 */
export async function getIndexStats(indexName?: string): Promise<any> {
  const index = getIndex(indexName);

  try {
    const stats = await index.describeIndexStats();
    return stats;
  } catch (error) {
    console.error("Error getting index stats:", error);
    throw error;
  }
}

/**
 * Build vector ID for a chunk
 * Format: "article-{articleId}-chunk-{chunkIndex}"
 */
export function buildVectorId(articleId: string, chunkIndex: number): string {
  return `article-${articleId}-chunk-${chunkIndex}`;
}

/**
 * Parse vector ID to extract article ID and chunk index
 */
export function parseVectorId(
  vectorId: string
): { articleId: string; chunkIndex: number } | null {
  const match = vectorId.match(/^article-(.+)-chunk-(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    articleId: match[1],
    chunkIndex: parseInt(match[2], 10),
  };
}
