# 🚀 RAG Setup & Testing Guide

## ✅ What's Been Implemented

The full RAG (Retrieval-Augmented Generation) system is now complete:

1. ✅ Text processing utilities (HTML cleaning, chunking)
2. ✅ OpenAI embeddings service with batching
3. ✅ Pinecone vector database client
4. ✅ Data ingestion API endpoints
5. ✅ RAG query orchestration with streaming
6. ✅ Updated chat API with real RAG pipeline
7. ✅ Frontend with streaming responses and citations

---

## 🔧 Setup Instructions

### Step 1: Configure Environment Variables

Create `.env.local` in the `chat-ui` directory:

```bash
# Required: OpenAI API Key
OPENAI_API_KEY=sk-proj-...

# Required: Pinecone API Key
PINECONE_API_KEY=...

# Optional: Pinecone Configuration
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=wordpress-archive

# Optional: Processing Configuration
CHUNK_SIZE=800
CHUNK_OVERLAP=200
EMBEDDING_BATCH_SIZE=100
```

**Get your API keys:**
- OpenAI: https://platform.openai.com/api-keys
- Pinecone: https://app.pinecone.io/

### Step 2: Install Dependencies (Already Done)

Dependencies installed:
- `openai` - OpenAI SDK
- `@pinecone-database/pinecone` - Pinecone client
- `ai` - Vercel AI SDK
- `zod` - Schema validation
- `papaparse` - CSV parsing

### Step 3: Start Development Server

```bash
npm run dev
```

Server will start at: **http://localhost:3001**

---

## 📊 Data Ingestion Workflow

### Phase 1: Check System Health

```bash
# Check if API keys are configured
curl http://localhost:3001/api/chat
```

Expected response:
```json
{
  "status": "not_ready",
  "config": {
    "openai": "configured",
    "pinecone": "configured",
    "index": "not_created"
  }
}
```

### Phase 2: Initialize Pinecone Index

```bash
# Create the Pinecone index (3072-dim, cosine similarity)
curl -X POST http://localhost:3001/api/ingest/init
```

Expected response:
```json
{
  "success": true,
  "message": "Index 'wordpress-archive' created successfully",
  "indexName": "wordpress-archive",
  "stats": { ... }
}
```

**Note:** This only needs to be done once. The index will persist in Pinecone.

### Phase 3: Ingest Sample Data (Test with 100 articles)

```bash
# Ingest first 100 articles from wordpress_posts.csv
curl -X POST "http://localhost:3001/api/ingest?batch=0&size=100"
```

Expected response:
```json
{
  "success": true,
  "message": "Successfully processed batch 0",
  "stats": {
    "articlesProcessed": 100,
    "chunksGenerated": 450,
    "embeddingsCreated": 450,
    "vectorsUpserted": 450,
    "totalTokens": 125000,
    "estimatedCost": 0.016
  },
  "duration": "45.23s",
  "progress": {
    "processed": 100,
    "remaining": 540809,
    "percentComplete": "0.02%"
  }
}
```

**Processing Time:**
- 100 articles: ~45 seconds
- 1,000 articles: ~7 minutes
- Full dataset (540K): ~12-24 hours

**Cost Estimates:**
- 100 articles: ~$0.02
- 1,000 articles: ~$0.15
- Full dataset: ~$50-100 (embeddings only)

### Phase 4: Test Chat Interface

1. Open **http://localhost:3001**
2. You should see the Hero Chat interface
3. Try a query: **"What articles discuss Stoicism?"**
4. Watch the streaming response appear token-by-token
5. Check citations below the response

---

## 🧪 Testing Checklist

### ✅ Environment Configuration
```bash
# Verify .env.local exists
[ -f .env.local ] && echo "✅ .env.local found" || echo "❌ Create .env.local"

# Check if variables are set
grep -q "OPENAI_API_KEY=" .env.local && echo "✅ OpenAI key configured" || echo "❌ Add OPENAI_API_KEY"
grep -q "PINECONE_API_KEY=" .env.local && echo "✅ Pinecone key configured" || echo "❌ Add PINECONE_API_KEY"
```

### ✅ API Health Checks
```bash
# 1. Check chat API status
curl http://localhost:3001/api/chat | jq '.config'

# 2. Check ingest API status
curl http://localhost:3001/api/ingest | jq '.csvFile'

# 3. Verify index exists
curl http://localhost:3001/api/ingest/init | jq '.exists'
```

### ✅ Sample Data Ingestion
```bash
# Ingest 10 articles for quick testing
curl -X POST "http://localhost:3001/api/ingest?batch=0&size=10" | jq '.stats'
```

### ✅ Chat Functionality

Test queries to try:
1. **"What have you written about discipline?"**
2. **"Find podcast episodes on productivity"**
3. **"Articles about Theodore Roosevelt"**
4. **"What fitness routines do you recommend?"**

Expected behavior:
- ✅ Streaming response appears token-by-token
- ✅ Citations display below the response
- ✅ Source URLs are clickable
- ✅ Relevance scores shown (e.g., "85% match")
- ✅ Conversation history maintained

---

## 📁 Project Structure

```
chat-ui/
├── lib/
│   ├── text-processing.ts      ✅ HTML cleaning, chunking
│   ├── embeddings.ts            ✅ OpenAI embeddings with batching
│   ├── pinecone.ts              ✅ Vector DB operations
│   ├── rag.ts                   ✅ RAG orchestration + streaming
│   └── utils.ts                 ✅ Utility functions
│
├── app/
│   ├── api/
│   │   ├── chat/route.ts        ✅ Streaming chat with RAG
│   │   └── ingest/
│   │       ├── init/route.ts    ✅ Index initialization
│   │       └── route.ts         ✅ Data ingestion
│   ├── layout.tsx               ✅ Root layout
│   ├── page.tsx                 ✅ Main page
│   └── globals.css              ✅ Global styles
│
├── components/ui/
│   ├── ruixen-moon-chat.tsx     ✅ Chat UI with streaming + citations
│   ├── button.tsx               ✅ shadcn Button
│   └── textarea.tsx             ✅ shadcn Textarea
│
├── .env.example                 ✅ Environment template
├── .env.local                   ⚠️  YOU CREATE THIS
└── package.json                 ✅ Dependencies installed
```

---

## 🔥 Full Dataset Ingestion (Production)

Once you've tested with sample data, ingest the full dataset:

### Option 1: Batch-by-Batch (Manual)

```bash
# Process batches of 100 articles
for i in {0..5408}; do
  echo "Processing batch $i..."
  curl -X POST "http://localhost:3001/api/ingest?batch=$i&size=100"
  sleep 2  # Rate limiting
done
```

### Option 2: Large Batches

```bash
# Process 1000 articles at a time (faster, but more expensive)
for i in {0..540}; do
  curl -X POST "http://localhost:3001/api/ingest?batch=$i&size=1000"
done
```

### Option 3: Node Script (Recommended)

Create `scripts/ingest-all.js`:

```javascript
const TOTAL_BATCHES = 5409; // 540,909 articles / 100
const BATCH_SIZE = 100;
const CONCURRENCY = 3; // Process 3 batches in parallel

async function ingestBatch(batchNumber) {
  const response = await fetch(
    `http://localhost:3001/api/ingest?batch=${batchNumber}&size=${BATCH_SIZE}`,
    { method: 'POST' }
  );
  return await response.json();
}

async function ingestAll() {
  for (let i = 0; i < TOTAL_BATCHES; i += CONCURRENCY) {
    const promises = [];
    for (let j = 0; j < CONCURRENCY && i + j < TOTAL_BATCHES; j++) {
      promises.push(ingestBatch(i + j));
    }
    const results = await Promise.all(promises);
    console.log(`Processed batches ${i} to ${i + CONCURRENCY - 1}`);
  }
}

ingestAll().then(() => console.log('Done!'));
```

Run:
```bash
node scripts/ingest-all.js
```

**Estimated time:** 12-24 hours for full dataset

---

## 🐛 Troubleshooting

### Issue: "Knowledge base not initialized"

**Solution:**
```bash
curl -X POST http://localhost:3001/api/ingest/init
```

### Issue: "OPENAI_API_KEY is not set"

**Solution:**
1. Create `.env.local` in `chat-ui/` directory
2. Add: `OPENAI_API_KEY=sk-proj-...`
3. Restart dev server

### Issue: "Failed to query vectors"

**Possible causes:**
- Pinecone index doesn't exist → Run `/api/ingest/init`
- No data ingested yet → Run `/api/ingest?batch=0&size=10`
- Wrong index name → Check `PINECONE_INDEX_NAME` in `.env.local`

### Issue: Slow responses

**Solutions:**
- Reduce `topK` in `lib/rag.ts` (default: 5)
- Use GPT-4o-mini instead of GPT-4o for faster responses
- Check Pinecone region (use same region as your location)

### Issue: Citations not appearing

**Causes:**
- Headers might be blocked by browser
- Check browser console for errors
- Verify citations are in API response headers

---

## 📊 Monitoring

### Check Index Stats
```bash
curl http://localhost:3001/api/ingest/init | jq '.stats'
```

Response:
```json
{
  "namespaces": {},
  "dimension": 3072,
  "indexFullness": 0.2,
  "totalVectorCount": 45000
}
```

### Monitor Costs

Track OpenAI usage:
- Embeddings: ~$0.00013 per 1K tokens
- GPT-4o: ~$0.03 per 1K tokens (input), ~$0.06 (output)

Example for 100 articles (~125K tokens):
- Embeddings: $0.016
- Queries (10 chats): ~$0.05
- **Total: ~$0.07**

---

## ✅ Success Criteria

Your RAG system is working correctly if:

1. ✅ Health check shows all systems "ready"
2. ✅ Sample ingestion completes without errors
3. ✅ Chat returns streaming responses
4. ✅ Citations display with valid URLs
5. ✅ Responses are grounded in retrieved context
6. ✅ Conversation history maintained across messages
7. ✅ No "I don't know" when data exists in the archive

---

## 🚀 Next Steps

After confirming everything works:

1. **Ingest full dataset** (optional - start with 1000 articles for testing)
2. **Fine-tune parameters**:
   - Adjust `topK` (number of chunks retrieved)
   - Tweak `temperature` (0.3 = factual, 0.7 = creative)
   - Modify chunk size/overlap in text-processing.ts
3. **Deploy to production**:
   - Deploy to Vercel, Netlify, or your hosting platform
   - Set environment variables in hosting dashboard
   - Pinecone data persists - no need to re-ingest
4. **Add features**:
   - User authentication
   - Conversation persistence (database)
   - Export chats as PDF/Markdown
   - Advanced search filters (date range, categories)

---

## 🆘 Need Help?

- Check logs in terminal (`npm run dev`)
- Test API endpoints with curl
- Verify environment variables are set
- Check Pinecone dashboard: https://app.pinecone.io/
- Review OpenAI API usage: https://platform.openai.com/usage

**Common pitfalls:**
- Missing `.env.local` file
- Wrong working directory (must be in `chat-ui/`)
- CSV file not in parent directory
- API keys have insufficient permissions

---

**Your RAG system is ready!** 🎉

Test with sample data first, then scale to the full dataset when ready.
