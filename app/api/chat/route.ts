/**
 * RAG Chat API Endpoint with Streaming
 *
 * POST /api/chat
 * Real-time streaming responses using Pinecone + OpenAI RAG pipeline
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryKnowledgeBaseStream } from "@/lib/rag";
import { indexExists } from "@/lib/pinecone";

/**
 * Request validation schema
 */
const ChatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

/**
 * Rate limiting (simple in-memory implementation)
 * For production, use Redis or Upstash
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, maxRequests = 100, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * POST /api/chat
 * Main chat endpoint with streaming RAG responses
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(identifier)) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = ChatRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { message, conversationHistory } = validation.data;

    // Check if Pinecone index exists
    const exists = await indexExists();
    if (!exists) {
      return NextResponse.json(
        {
          error: "Knowledge base not initialized",
          message: "The knowledge base index doesn't exist yet. Please run data ingestion first.",
          action: "POST /api/ingest/init to create the index",
        },
        { status: 503 }
      );
    }

    // Query the RAG pipeline with streaming
    console.log(`Processing query: "${message.substring(0, 50)}..."`);

    const { stream, citations } = await queryKnowledgeBaseStream(message, {
      topK: 5,
      temperature: 0.3,
      maxTokens: 800,
      conversationHistory,
    });

    // Create a response stream that includes citations metadata
    // We'll send citations as a special header
    const citationsHeader = JSON.stringify(citations);

    // Return streaming response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Citations": encodeURIComponent(citationsHeader),
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("OPENAI_API_KEY")) {
        return NextResponse.json(
          {
            error: "Configuration error",
            message: "OpenAI API key is not configured",
          },
          { status: 500 }
        );
      }

      if (error.message.includes("PINECONE_API_KEY")) {
        return NextResponse.json(
          {
            error: "Configuration error",
            message: "Pinecone API key is not configured",
          },
          { status: 500 }
        );
      }

      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          {
            error: "API rate limit",
            message: "OpenAI API rate limit reached. Please try again in a moment.",
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to process your request. Please try again.",
        details: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat
 * Health check and status endpoint
 */
export async function GET() {
  try {
    // Check environment variables
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasPinecone = !!process.env.PINECONE_API_KEY;

    // Check if index exists
    let indexStatus = "unknown";
    let indexStats = null;

    try {
      const exists = await indexExists();
      if (exists) {
        indexStatus = "ready";
        const { getIndexStats } = await import("@/lib/pinecone");
        indexStats = await getIndexStats();
      } else {
        indexStatus = "not_created";
      }
    } catch (error) {
      indexStatus = "error";
    }

    const isReady = hasOpenAI && hasPinecone && indexStatus === "ready";

    return NextResponse.json({
      status: isReady ? "ready" : "not_ready",
      message: isReady
        ? "RAG Chat API is ready"
        : "RAG Chat API requires configuration",
      version: "2.0.0-rag",
      timestamp: new Date().toISOString(),
      config: {
        openai: hasOpenAI ? "configured" : "missing",
        pinecone: hasPinecone ? "configured" : "missing",
        index: indexStatus,
      },
      indexStats: indexStatus === "ready" ? indexStats : null,
      endpoints: {
        chat: "POST /api/chat",
        initIndex: "POST /api/ingest/init",
        ingestData: "POST /api/ingest?batch=0&size=100",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to check system status",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
