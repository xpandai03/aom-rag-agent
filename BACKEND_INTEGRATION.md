# Backend Integration Guide: Connecting Chat UI to RAG Pipeline

This guide explains how to connect the Hero Chat Section to your Pinecone RAG backend for real knowledge base queries.

## 🎯 Overview

Current state: **Mock API** returning hardcoded responses
Target state: **Full RAG Pipeline** with Pinecone + OpenAI

## 📋 Prerequisites

From your project documentation (PROJECT_OVERVIEW.md, DATA_PIPELINE.md):
- WordPress archive data ingested into Pinecone
- Index name: `wordpress-archive`
- Embedding model: `text-embedding-3-large` (3072 dimensions)
- Metric: Cosine similarity
- Metadata fields: `title`, `url`, `content`, `chunk_id`

## 🔧 Step 1: Environment Setup

Create `.env.local` in the `chat-ui` directory:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...

# Pinecone Configuration
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east1-gcp
PINECONE_INDEX_NAME=wordpress-archive

# Optional: Rate limiting and caching
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

## 📦 Step 2: Install Dependencies

```bash
cd chat-ui
npm install openai @pinecone-database/pinecone
```

## 🔨 Step 3: Create RAG Utilities

Create `lib/rag.ts`:

```typescript
import { OpenAI } from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

interface Citation {
  title: string;
  url: string;
  score: number;
}

interface RAGResponse {
  reply: string;
  citations: Citation[];
}

/**
 * Main RAG query function
 * 1. Generate embedding for user query
 * 2. Query Pinecone for relevant chunks
 * 3. Construct context-aware prompt
 * 4. Generate response with GPT-4
 */
export async function queryKnowledgeBase(
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<RAGResponse> {
  try {
    // Step 1: Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      input: message,
      model: "text-embedding-3-large",
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Step 2: Query Pinecone
    const indexName = process.env.PINECONE_INDEX_NAME || "wordpress-archive";
    const index = pinecone.index(indexName);

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    });

    // Step 3: Extract context and citations
    const matches = queryResponse.matches || [];
    const context = matches
      .map((match) => {
        const metadata = match.metadata as Record<string, any>;
        return `[${metadata.title}]\n${metadata.content}`;
      })
      .join("\n\n---\n\n");

    const citations: Citation[] = matches.map((match) => {
      const metadata = match.metadata as Record<string, any>;
      return {
        title: metadata.title || "Untitled",
        url: metadata.url || "#",
        score: match.score || 0,
      };
    });

    // Step 4: Construct prompt with context
    const systemPrompt = `You are Brett McKay's personal knowledge assistant. You help Brett and his team search through his archive of 5,000+ articles and 1,000+ podcast transcripts from The Art of Manliness.

Your role:
- Answer questions based ONLY on the provided context
- Cite specific articles and podcasts when referencing information
- If the context doesn't contain relevant information, say so honestly
- Maintain a friendly, professional tone
- Format responses with clear structure (bullet points, numbered lists)

Context format: Each section starts with [Article Title] followed by relevant excerpt.

When citing, use format: "According to [Article Title]..." or "In [Article Title], you wrote..."`;

    const userPrompt = `Context from Brett's archive:

${context}

---

User question: ${message}

Please provide a helpful answer based on the context above. Include specific article titles and URLs in your response.`;

    // Step 5: Generate response with GPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // or "gpt-4-turbo" or "gpt-3.5-turbo"
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory.slice(-6), // Include last 6 messages for context
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const reply = completion.choices[0]?.message?.content || "No response generated.";

    return {
      reply,
      citations: citations.slice(0, 3), // Return top 3 citations
    };
  } catch (error) {
    console.error("RAG query error:", error);
    throw new Error("Failed to query knowledge base");
  }
}

/**
 * Alternative: Streaming version using OpenAI streaming
 */
export async function queryKnowledgeBaseStream(
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = []
) {
  // Similar to above, but returns a stream
  // Implement if you want streaming responses in the UI
}
```

## 🔌 Step 4: Update API Route

Replace the mock implementation in `app/api/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { queryKnowledgeBase } from "@/lib/rag";

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }

    // Validate environment variables
    if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY) {
      console.error("Missing API keys");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Query the RAG pipeline
    const result = await queryKnowledgeBase(message, conversationHistory);

    return NextResponse.json({
      reply: result.reply,
      citations: result.citations,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// Keep the health check endpoint
export async function GET() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasPinecone = !!process.env.PINECONE_API_KEY;

  return NextResponse.json({
    status: hasOpenAI && hasPinecone ? "ok" : "misconfigured",
    message: "Chat API with RAG backend",
    version: "1.0.0",
    config: {
      openai: hasOpenAI,
      pinecone: hasPinecone,
    },
  });
}
```

## 🎨 Step 5: Update UI to Display Citations

Enhance `components/ui/ruixen-moon-chat.tsx` to show citations:

```typescript
// Update Message interface
interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{
    title: string;
    url: string;
    score: number;
  }>;
}

// In the API call section, update to handle citations:
const data = await response.json();
setMessages((prev) => [
  ...prev,
  {
    role: "assistant",
    content: data.reply,
    citations: data.citations // Add this
  },
]);

// In the message rendering, add citations display:
{msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
  <div className="mt-3 space-y-2">
    <p className="text-xs text-neutral-400 font-semibold">Sources:</p>
    {msg.citations.map((citation, idx) => (
      <a
        key={idx}
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs text-blue-400 hover:text-blue-300 hover:underline"
      >
        📄 {citation.title}
      </a>
    ))}
  </div>
)}
```

## 🧪 Step 6: Test the Integration

### 6.1 Check Health Endpoint
```bash
curl http://localhost:3001/api/chat
```

Expected response:
```json
{
  "status": "ok",
  "message": "Chat API with RAG backend",
  "version": "1.0.0",
  "config": {
    "openai": true,
    "pinecone": true
  }
}
```

### 6.2 Test a Query
Open http://localhost:3001 and try:
- "What articles discuss discipline?"
- "Show me podcast episodes about stoicism"
- "What have you written about Theodore Roosevelt?"

### 6.3 Verify Pinecone Connection
```bash
# In a separate terminal, test Pinecone directly
node -e "
const { Pinecone } = require('@pinecone-database/pinecone');
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
pc.index('wordpress-archive').describeIndexStats()
  .then(stats => console.log('Pinecone stats:', stats))
  .catch(err => console.error('Error:', err));
"
```

## 🚀 Step 7: Optional Enhancements

### 7.1 Add Streaming Responses
```bash
npm install ai
```

Update API route to use Vercel AI SDK:
```typescript
import { OpenAIStream, StreamingTextResponse } from 'ai';

export async function POST(request: NextRequest) {
  // ... retrieve context from Pinecone ...

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    stream: true,
    messages: [...],
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
```

### 7.2 Add Conversation Memory
Store conversation history in component state and send with each request:

```typescript
const handleSubmit = async () => {
  // ... existing code ...

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: userMessage,
      conversationHistory: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    }),
  });

  // ... rest of code ...
};
```

### 7.3 Add Error Handling & Retry Logic
```typescript
// lib/rag.ts
export async function queryKnowledgeBase(message: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // ... existing code ...
      return result;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 7.4 Add Rate Limiting
```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
});
```

## 📊 Step 8: Monitor & Optimize

### Track Key Metrics:
- Query latency (embedding + Pinecone + GPT)
- Citation relevance scores
- User feedback on responses
- Cost per query (OpenAI tokens + Pinecone operations)

### Optimization Tips:
1. **Cache frequent queries**: Use Redis or in-memory cache
2. **Batch embeddings**: If users send multiple queries
3. **Adjust top_k**: Experiment with 3-10 chunks
4. **Fine-tune prompts**: Iterate based on response quality
5. **Use GPT-4o mini**: For faster/cheaper responses on simple queries

## 🔐 Security Checklist

- [ ] API keys in .env.local (never commit)
- [ ] Rate limiting enabled
- [ ] Input validation on all user queries
- [ ] Error messages don't leak sensitive info
- [ ] CORS configured properly
- [ ] Consider adding authentication in Phase 2

## 📝 Troubleshooting

### Issue: "Failed to query knowledge base"
- Check Pinecone index exists: `pinecone.listIndexes()`
- Verify embedding dimensions match (3072)
- Check API key permissions

### Issue: Empty or irrelevant responses
- Review Pinecone metadata structure
- Check if `content` field is populated
- Adjust similarity threshold (min score: 0.7)

### Issue: Slow responses
- Monitor Pinecone query time
- Consider using GPT-4o mini instead of GPT-4
- Reduce top_k or max_tokens

## 🎯 Success Criteria

✅ API health check shows "ok"
✅ Queries return responses from Pinecone context
✅ Citations display correctly with valid URLs
✅ Responses are grounded in Brett's archive
✅ No hardcoded mock responses
✅ Error handling works gracefully
✅ Performance is under 5 seconds per query

---

**Next Steps After Integration:**
1. Test with real queries from Brett's team
2. Gather feedback on response quality
3. Iterate on system prompt and retrieval parameters
4. Add analytics dashboard (Phase 2)
5. Consider public-facing "Chat the Archive" feature (Phase 3)

**Questions?** Refer to:
- PROJECT_OVERVIEW.md for system architecture
- DATA_PIPELINE.md for Pinecone setup details
- OpenAI API docs: https://platform.openai.com/docs
- Pinecone docs: https://docs.pinecone.io
