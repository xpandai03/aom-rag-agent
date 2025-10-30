  ---
  ✅ Architecture Verification

  ChatGPT's description is 95% accurate, but missing a few
  key details:

  What ChatGPT Got Right:

  - ✅ Frontend: Next.js + TypeScript + Tailwind + shadcn UI
  - ✅ Chat UI component: rueixen-moon-chat.tsx
  - ✅ API route: /app/api/chat/route.ts
  - ✅ OpenAI SDK: Using gpt-4o + text-embedding-3-large
  - ✅ Pinecone: Vector database with wordpress-archive
  index (3072 dimensions)
  - ✅ Data pipeline scripts: /lib/embeddings.ts and
  /lib/pinecone.ts
  - ✅ Source data: wordpress_posts.csv at project root
  - ✅ Phase 2 automation: NOT yet implemented (manual
  ingestion only)

  What ChatGPT Missed:

  - ❌ Missing ingestion API routes that already exist:
    - POST /api/ingest/init - Creates/initializes Pinecone
  index
    - POST /api/ingest?batch=X&size=Y - Batch uploads data
  from CSV
  - ❌ Missing RAG orchestrator: /lib/rag.ts (handles the
  entire RAG pipeline)
  - ❌ Missing text processing: /lib/text-processing.ts
  (HTML cleaning, chunking)

  ---
  🎯 Answering Your Specific Questions

  1. Where does the system prompt live?

  Location: /chat-ui/lib/rag.ts at lines 47-70

  The system prompt is defined in the buildSystemPrompt()
  function:

  function buildSystemPrompt(): string {
    return `You are Brett McKay's private AI assistant, 
  trained exclusively on his Art of Manliness archive.

  ROLE:
  - Help Brett and his team search through 5,000+ articles 
  and 1,000+ podcast transcripts
  - Provide accurate, grounded answers based ONLY on the 
  provided context
  - Cite specific article titles and sources

  RULES:
  1. Base ALL responses on the provided context - never make
   up information
  2. If the context doesn't contain relevant information, 
  honestly say "I don't have information about that in your 
  archive"
  3. Cite specific article titles when referencing 
  information
  4. Use markdown formatting (bold titles, bullet points, 
  numbered lists)
  5. Keep tone professional, helpful, and concise
  6. When multiple articles cover a topic, list the most 
  relevant ones

  FORMAT:
  - Start with a direct answer to the question
  - Include specific article titles in bold
  - Use bullet points or numbered lists for multiple items
  - Keep paragraphs short and scannable

  Remember: Your knowledge is LIMITED to the provided 
  context. If you're not confident an answer is in the 
  context, say so.`;
  }

  To update the system prompt:
  # Edit this file
  /chat-ui/lib/rag.ts

  # Modify the buildSystemPrompt() function (line 47-70)
  # No rebuild needed - changes apply immediately on next 
  query

  ---
  2. How to update the agent's vector store with new 
  content?

  You have TWO methods available:

  Method A: Manual CSV Update + API Ingestion (Currently 
  Available)

  Step 1: Update your data source
  # Replace or append to the CSV file
  /wordpress_posts.csv

  Step 2: Initialize the index (first time only)
  POST http://localhost:3000/api/ingest/init

  # Response: Index created and ready

  Step 3: Run batch ingestion
  # Ingest in batches (100 articles per batch)
  POST http://localhost:3000/api/ingest?batch=0&size=100
  POST http://localhost:3000/api/ingest?batch=1&size=100
  POST http://localhost:3000/api/ingest?batch=2&size=100
  # ... continue for all batches

  Step 4: Query parameters:
  - batch: Batch number (0-indexed)
  - size: Articles per batch (1-500, recommended: 100)

  Example using curl:
  # Initialize
  curl -X POST http://localhost:3000/api/ingest/init

  # Ingest first batch
  curl -X POST
  "http://localhost:3000/api/ingest?batch=0&size=100"

  # Check progress - API returns:
  # - vectorsUpserted: count
  # - articles processed
  # - timing stats

  ---
  Method B: Automated Pipeline (Phase 2 - Not Yet 
  Implemented)

  This is what ChatGPT mentioned as "What's Next". Here's
  what you'd need to build:

  Google Drive Upload
          ↓
     Make.com Watcher (monitor folder for new CSV/PDF)
          ↓
     Webhook/Cloud Function
          ↓
     Call /api/ingest endpoint
          ↓
     Auto-embed and upsert to Pinecone
          ↓
     Send Slack/Email notification

  To implement this, you would need:
  1. Create a Make.com scenario that watches a Google Drive
  folder
  2. Trigger on new file upload (CSV or PDF)
  3. Send file to a new API endpoint (e.g.,
  /api/ingest/upload)
  4. Parse and process the file
  5. Call existing ingestion logic
  6. Return success/failure notification

  ---
  📋 Quick Reference: Update Workflows

  Updating System Prompt:

  1. Edit: /chat-ui/lib/rag.ts (line 47-70)
  2. Save file
  3. Done - next query uses new prompt

  Adding New Content to Vector Store:

  1. Update: /wordpress_posts.csv (add new rows)
  2. POST /api/ingest/init (if first time)
  3. POST /api/ingest?batch=0&size=100 (repeat for all
  batches)
  4. Done - new content searchable

  Monitoring Ingestion:

  # Check index stats
  GET http://localhost:3000/api/chat

  # Returns:
  # - Index status
  # - Vector count
  # - Dimension size

  ---
  🔑 Key Files Summary

  | Component     | File Path                             |
  Purpose                            |
  |---------------|---------------------------------------|-
  -----------------------------------|
  | System Prompt | /chat-ui/lib/rag.ts:47-70             |
  Defines agent behavior/personality |
  | Data Source   | /wordpress_posts.csv                  |
  Raw content (5K+ articles)         |
  | Ingestion API | /chat-ui/app/api/ingest/route.ts      |
  Batch upload to Pinecone           |
  | Init API      | /chat-ui/app/api/ingest/init/route.ts |
  Create/verify index                |
  | Chat API      | /chat-ui/app/api/chat/route.ts        |
  RAG query endpoint                 |
  | RAG Logic     | /chat-ui/lib/rag.ts                   |
  Retrieval + generation pipeline    |
  | Embeddings    | /chat-ui/lib/embeddings.ts            |
  OpenAI embedding service           |
  | Vector DB     | /chat-ui/lib/pinecone.ts              |
  Pinecone client wrapper            |

  ---
  Does this clarify your confusion? The architecture is
  solid - you just have two easy ways to update content (CSV
   + API) and the system prompt lives in a single, editable
  function in rag.ts.
