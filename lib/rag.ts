/**
 * RAG (Retrieval-Augmented Generation) Orchestrator
 *
 * End-to-end pipeline: query → embedding → retrieval → generation
 */

import { OpenAI } from "openai";
import { getOpenAIClient, embedQuery } from "./embeddings";
import { queryVectors, QueryResult } from "./pinecone";

/**
 * Citation from retrieved context
 */
export interface Citation {
  title: string;
  url: string;
  relevance: number;
  snippet: string;
}

/**
 * RAG query options
 */
export interface RAGOptions {
  topK?: number;                    // Number of chunks to retrieve (default: 5)
  temperature?: number;              // LLM temperature (default: 0.3)
  maxTokens?: number;                // Max response tokens (default: 800)
  conversationHistory?: Array<{     // Previous messages for context
    role: "user" | "assistant";
    content: string;
  }>;
}

/**
 * RAG query result
 */
export interface RAGResult {
  answer: string;
  citations: Citation[];
  retrievedChunks: number;
  model: string;
}

/**
 * Build system prompt for the RAG assistant
 */
function buildSystemPrompt(): string {
  return `You are Brett McKay's private AI assistant, trained exclusively on his Art of Manliness archive.

ROLE:
- Help Brett and his team search through 5,000+ articles and 1,000+ podcast transcripts
- Provide accurate, grounded answers based ONLY on the provided context
- Cite specific article titles and sources

RULES:
1. Base ALL responses on the provided context - never make up information
2. If the context doesn't contain relevant information, honestly say "I don't have information about that in your archive"
3. Cite specific article titles when referencing information
4. Use markdown formatting (bold titles, bullet points, numbered lists)
5. Keep tone professional, helpful, and concise
6. When multiple articles cover a topic, list the most relevant ones

FORMAT:
- Start with a direct answer to the question
- Include specific article titles in bold
- Use bullet points or numbered lists for multiple items
- Keep paragraphs short and scannable

Remember: Your knowledge is LIMITED to the provided context. If you're not confident an answer is in the context, say so.`;
}

/**
 * Build user prompt with context and query
 */
function buildUserPrompt(
  query: string,
  retrievedContext: QueryResult[]
): string {
  // Build context from retrieved chunks
  const contextSections = retrievedContext.map((result, idx) => {
    return `[${idx + 1}] Title: "${result.metadata.title}"
URL: ${result.metadata.url}
Relevance: ${(result.score * 100).toFixed(1)}%

Content:
${result.metadata.content}`;
  }).join("\n\n---\n\n");

  return `CONTEXT FROM BRETT'S ARCHIVE:

${contextSections}

---

USER QUERY: ${query}

Please provide a helpful answer based on the context above. Include specific article titles and format your response with markdown.`;
}

/**
 * Main RAG query function
 *
 * @param query - User's question
 * @param options - RAG configuration options
 * @returns Answer with citations
 */
export async function queryKnowledgeBase(
  query: string,
  options: RAGOptions = {}
): Promise<RAGResult> {
  const {
    topK = 5,
    temperature = 0.3,
    maxTokens = 800,
    conversationHistory = [],
  } = options;

  // Step 1: Generate embedding for the query
  console.log("Generating query embedding...");
  const queryEmbedding = await embedQuery(query);

  // Step 2: Retrieve relevant chunks from Pinecone
  console.log(`Searching Pinecone for top ${topK} results...`);
  const retrievedChunks = await queryVectors(queryEmbedding, {
    topK,
    includeMetadata: true,
  });

  if (retrievedChunks.length === 0) {
    return {
      answer: "I couldn't find any relevant information in the archive for your question. Could you try rephrasing or asking about a different topic?",
      citations: [],
      retrievedChunks: 0,
      model: "gpt-4o",
    };
  }

  console.log(`Retrieved ${retrievedChunks.length} relevant chunks`);

  // Step 3: Extract citations
  const citations: Citation[] = retrievedChunks.map((chunk) => ({
    title: chunk.metadata.title,
    url: chunk.metadata.url,
    relevance: chunk.score,
    snippet: chunk.metadata.content.substring(0, 150) + "...",
  }));

  // Step 4: Build messages for GPT
  const systemMessage: OpenAI.ChatCompletionMessageParam = {
    role: "system",
    content: buildSystemPrompt(),
  };

  const contextMessage: OpenAI.ChatCompletionMessageParam = {
    role: "user",
    content: buildUserPrompt(query, retrievedChunks),
  };

  // Include conversation history (limit to last 6 messages)
  const historyMessages: OpenAI.ChatCompletionMessageParam[] =
    conversationHistory.slice(-6).map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    systemMessage,
    ...historyMessages,
    contextMessage,
  ];

  // Step 5: Generate response with GPT-4o
  console.log("Generating response with GPT-4o...");
  const client = getOpenAIClient();

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    });

    const answer = completion.choices[0]?.message?.content || "No response generated.";

    return {
      answer,
      citations,
      retrievedChunks: retrievedChunks.length,
      model: completion.model,
    };
  } catch (error) {
    console.error("Error generating response:", error);
    throw new Error(`Failed to generate response: ${(error as Error).message}`);
  }
}

/**
 * Streaming RAG query function
 * Returns a ReadableStream for token-by-token responses
 */
export async function queryKnowledgeBaseStream(
  query: string,
  options: RAGOptions = {}
): Promise<{
  stream: ReadableStream;
  citations: Citation[];
}> {
  const {
    topK = 5,
    temperature = 0.3,
    maxTokens = 800,
    conversationHistory = [],
  } = options;

  // Step 1 & 2: Generate embedding and retrieve chunks
  console.log("Generating query embedding...");
  const queryEmbedding = await embedQuery(query);

  console.log(`Searching Pinecone for top ${topK} results...`);
  const retrievedChunks = await queryVectors(queryEmbedding, {
    topK,
    includeMetadata: true,
  });

  // Extract citations
  const citations: Citation[] = retrievedChunks.map((chunk) => ({
    title: chunk.metadata.title,
    url: chunk.metadata.url,
    relevance: chunk.score,
    snippet: chunk.metadata.content.substring(0, 150) + "...",
  }));

  if (retrievedChunks.length === 0) {
    // Return empty results as stream
    const encoder = new TextEncoder();
    const message = "I couldn't find any relevant information in the archive for your question.";

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(message));
        controller.close();
      },
    });

    return { stream, citations: [] };
  }

  // Build messages
  const systemMessage: OpenAI.ChatCompletionMessageParam = {
    role: "system",
    content: buildSystemPrompt(),
  };

  const contextMessage: OpenAI.ChatCompletionMessageParam = {
    role: "user",
    content: buildUserPrompt(query, retrievedChunks),
  };

  const historyMessages: OpenAI.ChatCompletionMessageParam[] =
    conversationHistory.slice(-6).map((msg) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    systemMessage,
    ...historyMessages,
    contextMessage,
  ];

  // Create streaming completion
  console.log("Creating streaming response...");
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  // Convert OpenAI stream to ReadableStream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return { stream, citations };
}

/**
 * Rerank retrieved chunks by relevance
 * Simple implementation - can be enhanced with cross-encoders
 */
export function rerankResults(
  query: string,
  results: QueryResult[]
): QueryResult[] {
  // For now, just sort by score (already done by Pinecone)
  // Future: implement cross-encoder reranking
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Query expansion - generate alternative queries
 * Useful for improving retrieval coverage
 */
export async function expandQuery(query: string): Promise<string[]> {
  // Simple keyword extraction for now
  // Future: use LLM to generate alternative phrasings
  const keywords = query.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
  return [query, ...keywords];
}
