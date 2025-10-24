/**
 * Index Initialization Endpoint
 *
 * POST /api/ingest/init
 * Creates the Pinecone index if it doesn't exist
 */

import { NextRequest, NextResponse } from "next/server";
import { createIndex, indexExists, getIndexName, getIndexStats } from "@/lib/pinecone";

export async function POST(request: NextRequest) {
  try {
    const indexName = getIndexName();

    console.log(`Checking if index "${indexName}" exists...`);
    const exists = await indexExists();

    if (exists) {
      // Get current stats
      const stats = await getIndexStats();

      return NextResponse.json({
        success: true,
        message: `Index "${indexName}" already exists`,
        indexName,
        exists: true,
        stats,
      });
    }

    // Create the index
    console.log(`Creating index "${indexName}"...`);
    await createIndex();

    // Get stats for the new index
    const stats = await getIndexStats();

    return NextResponse.json({
      success: true,
      message: `Index "${indexName}" created successfully`,
      indexName,
      exists: false,
      stats,
    });
  } catch (error) {
    console.error("Error initializing index:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize index",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check index status
export async function GET(request: NextRequest) {
  try {
    const indexName = getIndexName();
    const exists = await indexExists();

    if (!exists) {
      return NextResponse.json({
        success: true,
        indexName,
        exists: false,
        message: `Index "${indexName}" does not exist. Call POST /api/ingest/init to create it.`,
      });
    }

    const stats = await getIndexStats();

    return NextResponse.json({
      success: true,
      indexName,
      exists: true,
      stats,
    });
  } catch (error) {
    console.error("Error checking index:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check index",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
