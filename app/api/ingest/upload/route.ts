import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prepareArticle, parsePDF, estimateTokens } from "@/lib/text-processing";
import { batchGenerateEmbeddings, estimateEmbeddingCost } from "@/lib/embeddings";
import { upsertVectors, buildVectorId, VectorRecord, getIndexStats } from "@/lib/pinecone";

/**
 * POST /api/ingest/upload
 *
 * Accepts CSV or PDF files and ingests them into Pinecone
 *
 * Form data:
 * - file: CSV or PDF file
 * - source: (optional) "google-drive" or "manual"
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const source = formData.get("source") as string || "unknown";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const fileType = file.type;
    const buffer = Buffer.from(await file.arrayBuffer());

    console.log(`📄 Processing file: ${fileName} (${fileType}, ${buffer.length} bytes)`);

    let articles: Array<{ id: string; title: string; url: string; content: string }> = [];

    // Parse based on file type
    if (fileName.endsWith(".csv") || fileType === "text/csv") {
      articles = await parseCSVFile(buffer);
    } else if (fileName.endsWith(".pdf") || fileType === "application/pdf") {
      articles = await parsePDFFile(buffer, fileName);
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType}. Only CSV and PDF are supported.` },
        { status: 400 }
      );
    }

    if (articles.length === 0) {
      return NextResponse.json(
        { error: "No valid articles found in file" },
        { status: 400 }
      );
    }

    console.log(`✅ Parsed ${articles.length} articles from ${fileName}`);

    // Validate total token count before processing
    const totalContent = articles.map(a => a.content).join('\n');
    const estimatedTokens = estimateTokens(totalContent);

    if (estimatedTokens > 200000) {
      console.error(`❌ Document too large: ${estimatedTokens.toLocaleString()} tokens (max: 200,000)`);
      return NextResponse.json(
        {
          error: `Document too large (${estimatedTokens.toLocaleString()} tokens). Maximum: 200,000 tokens.`,
          stats: {
            estimatedTokens,
            maxTokens: 200000,
          }
        },
        { status: 413 }
      );
    }

    console.log(`📊 Estimated tokens: ${estimatedTokens.toLocaleString()}`);

    // Process articles through the pipeline
    const result = await processArticles(articles);

    return NextResponse.json({
      success: true,
      file: {
        name: fileName,
        type: fileType,
        size: buffer.length,
        source,
      },
      stats: result,
    });

  } catch (error) {
    console.error("Upload ingestion error:", error);
    return NextResponse.json(
      { error: `Ingestion failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

/**
 * Parse CSV buffer into articles
 */
async function parseCSVFile(buffer: Buffer): Promise<Array<{ id: string; title: string; url: string; content: string }>> {
  const csvText = buffer.toString("utf-8");

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const articles = results.data
          .map((row: any, index: number) => {
            // Support flexible column names
            const id = row.id || row.ID || row.post_id || String(index);
            const title = row.title || row.Title || row.post_title || "Untitled";
            const url = row.url || row.URL || row.link || row.permalink || "";
            const content = row.content || row.Content || row.post_content || row.body || "";

            if (!content || content.trim().length === 0) {
              console.warn(`⚠️  Skipping row ${index}: no content`);
              return null;
            }

            return { id, title, url, content };
          })
          .filter(Boolean) as Array<{ id: string; title: string; url: string; content: string }>;

        resolve(articles);
      },
      error: (error: Error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

/**
 * Parse PDF buffer into a single article
 */
async function parsePDFFile(buffer: Buffer, fileName: string): Promise<Array<{ id: string; title: string; url: string; content: string }>> {
  const text = await parsePDF(buffer);

  if (!text || text.trim().length === 0) {
    throw new Error("PDF contains no extractable text");
  }

  // Create a single article from the PDF
  const title = fileName.replace(/\.pdf$/i, "");
  const id = `pdf-${Date.now()}`;

  return [{
    id,
    title,
    url: "", // PDFs don't have URLs by default
    content: text,
  }];
}

/**
 * Process articles through the RAG pipeline
 * (Reuses existing logic from /api/ingest/route.ts)
 */
async function processArticles(articles: Array<{ id: string; title: string; url: string; content: string }>) {
  const startTime = Date.now();

  // Step 1: Prepare articles (clean + chunk)
  console.log("🧹 Cleaning and chunking articles...");
  const preparedArticles = articles.map(article =>
    prepareArticle(article.id, article.title, article.url, article.content)
  );

  // Collect all chunks and track article boundaries
  const allChunks: string[] = [];
  const chunkMetadata: Array<{ articleId: string; title: string; url: string; chunkIndex: number }> = [];

  preparedArticles.forEach((prepared) => {
    prepared.chunks.forEach((chunk, chunkIndex) => {
      allChunks.push(chunk);
      chunkMetadata.push({
        articleId: prepared.id,
        title: prepared.title,
        url: prepared.url,
        chunkIndex,
      });
    });
  });

  console.log(`📝 Generated ${allChunks.length} chunks from ${articles.length} articles`);

  // Step 2: Generate embeddings
  console.log("🔮 Generating embeddings...");
  const embeddings = await batchGenerateEmbeddings(allChunks, {
    batchSize: 100,
    concurrency: 5,
    onProgress: (completed, total) => {
      if (completed % 50 === 0 || completed === total) {
        console.log(`   Progress: ${completed}/${total} embeddings`);
      }
    },
  });

  // Step 3: Build vector records
  console.log("📦 Building vector records...");
  const vectors: VectorRecord[] = embeddings.map((embedding, index) => {
    const metadata = chunkMetadata[index];
    return {
      id: buildVectorId(metadata.articleId, metadata.chunkIndex),
      values: embedding,
      metadata: {
        title: metadata.title,
        url: metadata.url,
        content: allChunks[index],
        chunkIndex: metadata.chunkIndex,
        articleId: metadata.articleId,
      },
    };
  });

  // Step 4: Upsert to Pinecone
  console.log("☁️  Upserting to Pinecone...");
  await upsertVectors(vectors, {
    batchSize: 100,
    onProgress: (completed, total) => {
      console.log(`   Upserted: ${completed}/${total} vectors`);
    },
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Get updated index stats
  const indexStats = await getIndexStats();

  return {
    articlesProcessed: articles.length,
    chunksGenerated: allChunks.length,
    vectorsUpserted: vectors.length,
    totalTokens: preparedArticles.reduce((sum, p) => sum + p.totalTokens, 0),
    estimatedCost: estimateEmbeddingCost(
      preparedArticles.reduce((sum, p) => sum + p.totalTokens, 0)
    ),
    durationSeconds: parseFloat(duration),
    indexStats,
  };
}
