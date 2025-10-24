/**
 * Data Ingestion Endpoint
 *
 * POST /api/ingest?batch=0&size=100
 * Processes WordPress articles from CSV, generates embeddings, and uploads to Pinecone
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";
import { prepareArticle } from "@/lib/text-processing";
import { batchGenerateEmbeddings, estimateEmbeddingCost } from "@/lib/embeddings";
import { upsertVectors, buildVectorId, indexExists, VectorRecord } from "@/lib/pinecone";

interface CSVRow {
  [key: string]: string;
}

interface IngestionStats {
  articlesProcessed: number;
  chunksGenerated: number;
  embeddingsCreated: number;
  vectorsUpserted: number;
  totalTokens: number;
  estimatedCost: number;
  errors: number;
}

/**
 * POST /api/ingest
 * Process and ingest articles in batches
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if index exists
    const exists = await indexExists();
    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Pinecone index does not exist. Please create it first using POST /api/ingest/init",
        },
        { status: 400 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const batchNumber = parseInt(searchParams.get("batch") || "0", 10);
    const batchSize = parseInt(searchParams.get("size") || "100", 10);

    // Validate parameters
    if (batchNumber < 0 || batchSize <= 0 || batchSize > 500) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid batch parameters. batch >= 0, size between 1-500",
        },
        { status: 400 }
      );
    }

    // Read CSV file
    const csvPath = path.join(process.cwd(), "..", "wordpress_posts.csv");
    let csvData: string;

    try {
      csvData = await fs.readFile(csvPath, "utf-8");
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not read wordpress_posts.csv file",
          details: (error as Error).message,
        },
        { status: 500 }
      );
    }

    // Parse CSV
    const parsed = Papa.parse<CSVRow>(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      console.warn("CSV parsing warnings:", parsed.errors);
    }

    const allArticles = parsed.data;
    const totalArticles = allArticles.length;

    // Calculate batch range
    const startIdx = batchNumber * batchSize;
    const endIdx = Math.min(startIdx + batchSize, totalArticles);

    if (startIdx >= totalArticles) {
      return NextResponse.json({
        success: true,
        message: "Batch index out of range. All articles already processed.",
        stats: {
          totalArticles,
          batchNumber,
          articlesProcessed: 0,
        },
      });
    }

    const batchArticles = allArticles.slice(startIdx, endIdx);

    console.log(
      `Processing batch ${batchNumber}: articles ${startIdx} to ${endIdx - 1} (${batchArticles.length} articles)`
    );

    // Initialize stats
    const stats: IngestionStats = {
      articlesProcessed: 0,
      chunksGenerated: 0,
      embeddingsCreated: 0,
      vectorsUpserted: 0,
      totalTokens: 0,
      estimatedCost: 0,
      errors: 0,
    };

    // Process articles
    const allVectors: VectorRecord[] = [];
    const allChunkTexts: string[] = [];
    const chunkToVectorMap: Array<{
      articleId: string;
      title: string;
      url: string;
      chunkIndex: number;
      content: string;
    }> = [];

    for (const row of batchArticles) {
      try {
        // Extract fields (adjust based on your CSV structure)
        const id = row["18"] || row.id || "";  // First column is usually ID
        const title = row[Object.keys(row)[1]] || "";  // Second column
        const url = row[Object.keys(row)[2]] || "";    // Third column
        const content = row[Object.keys(row)[3]] || ""; // Fourth column

        if (!id || !title || !content) {
          console.warn(`Skipping article with missing data: ID=${id}, Title=${title}`);
          stats.errors++;
          continue;
        }

        // Prepare article (clean HTML, chunk text)
        const prepared = prepareArticle(id, title, url, content);

        stats.articlesProcessed++;
        stats.chunksGenerated += prepared.chunks.length;
        stats.totalTokens += prepared.totalTokens;

        // Store chunks and build mapping
        prepared.chunks.forEach((chunk, chunkIndex) => {
          allChunkTexts.push(chunk);
          chunkToVectorMap.push({
            articleId: id,
            title: prepared.title,
            url: prepared.url,
            chunkIndex,
            content: chunk,
          });
        });
      } catch (error) {
        console.error(`Error processing article ${row.id}:`, error);
        stats.errors++;
      }
    }

    if (allChunkTexts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid chunks to process in this batch",
        stats,
      });
    }

    // Generate embeddings in batches
    console.log(`Generating embeddings for ${allChunkTexts.length} chunks...`);
    const embeddings = await batchGenerateEmbeddings(allChunkTexts, {
      batchSize: 100,
      concurrency: 5,
      onProgress: (completed, total) => {
        console.log(`Embeddings progress: ${completed}/${total}`);
      },
    });

    stats.embeddingsCreated = embeddings.length;

    // Build vector records
    embeddings.forEach((embedding, idx) => {
      const mapping = chunkToVectorMap[idx];
      const vectorId = buildVectorId(mapping.articleId, mapping.chunkIndex);

      allVectors.push({
        id: vectorId,
        values: embedding,
        metadata: {
          title: mapping.title,
          url: mapping.url,
          content: mapping.content,
          chunkIndex: mapping.chunkIndex,
          articleId: mapping.articleId,
        },
      });
    });

    // Upsert to Pinecone
    console.log(`Upserting ${allVectors.length} vectors to Pinecone...`);
    await upsertVectors(allVectors, {
      batchSize: 100,
      onProgress: (completed, total) => {
        console.log(`Upsert progress: ${completed}/${total}`);
      },
    });

    stats.vectorsUpserted = allVectors.length;
    stats.estimatedCost = estimateEmbeddingCost(stats.totalTokens);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Successfully processed batch ${batchNumber}`,
      batch: {
        number: batchNumber,
        size: batchSize,
        startIdx,
        endIdx,
        articlesInBatch: batchArticles.length,
      },
      stats,
      duration: `${(duration / 1000).toFixed(2)}s`,
      totalArticles,
      progress: {
        processed: endIdx,
        remaining: totalArticles - endIdx,
        percentComplete: ((endIdx / totalArticles) * 100).toFixed(2) + "%",
      },
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to ingest data",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ingest
 * Returns ingestion status and instructions
 */
export async function GET(request: NextRequest) {
  try {
    const csvPath = path.join(process.cwd(), "..", "wordpress_posts.csv");
    const csvStats = await fs.stat(csvPath);

    // Read CSV to get total articles
    const csvData = await fs.readFile(csvPath, "utf-8");
    const parsed = Papa.parse(csvData, { header: true });
    const totalArticles = parsed.data.length;

    return NextResponse.json({
      success: true,
      message: "Data ingestion endpoint ready",
      csvFile: {
        path: csvPath,
        size: `${(csvStats.size / 1024 / 1024).toFixed(2)} MB`,
        totalArticles,
      },
      usage: {
        initializeIndex: "POST /api/ingest/init",
        ingestBatch: "POST /api/ingest?batch=0&size=100",
        example: "POST /api/ingest?batch=0&size=100  (process first 100 articles)",
      },
      estimatedBatches: Math.ceil(totalArticles / 100),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get ingestion status",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
