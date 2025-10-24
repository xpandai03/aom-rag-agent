# Private Knowledge GPT - Hero Chat Section

A Next.js chat interface for querying Brett McKay's WordPress archive using RAG (Retrieval-Augmented Generation).

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 📁 Project Structure

```
chat-ui/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # Mock chat API endpoint
│   ├── layout.tsx                # Root layout with metadata
│   ├── page.tsx                  # Main landing page
│   └── globals.css               # Global styles + Tailwind
├── components/
│   └── ui/
│       ├── button.tsx            # shadcn Button component
│       ├── textarea.tsx          # shadcn Textarea component
│       └── ruixen-moon-chat.tsx  # Main chat component
├── lib/
│   └── utils.ts                  # Utility functions (cn helper)
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json
```

## 🎯 Features Implemented

### 1. Hero Chat Component (`ruixen-moon-chat.tsx`)
- **Hero View**: Beautiful landing page with moon background
- **Auto-resizing Textarea**: Expands as user types (48px - 150px)
- **Quick Action Buttons**: Pre-filled query suggestions
- **Chat View**: Full conversation interface after first message
- **Message State Management**: React state for conversation history
- **Loading States**: Visual feedback during API calls
- **Keyboard Shortcuts**: Enter to send, Shift+Enter for new line

### 2. Mock Chat API (`/api/chat`)
- **POST /api/chat**: Accepts user messages, returns AI responses
- **GET /api/chat**: Health check endpoint
- **Keyword-based responses**: Returns relevant content based on query
- **Sample citations**: Demonstrates how to include article titles and URLs

### 3. shadcn/ui Integration
- Button component with multiple variants
- Textarea component with proper styling
- Tailwind CSS with custom theme variables
- Proper TypeScript types

## 🔄 User Flow

1. **Landing**: User sees hero view with title and input box
2. **First Message**: User types query and hits Enter or clicks Send
3. **Transition**: View switches to chat interface
4. **Conversation**: Messages display in conversation format
5. **Follow-ups**: User can continue asking questions

## 🎨 UI Components

### Hero View
- Full-height background with moon image
- Centered title: "Private Knowledge GPT"
- Subtitle: "Search through Brett McKay's archive"
- Input box with semi-transparent black background
- Quick action chips for common queries

### Chat View
- Fixed header with app title
- Scrollable message container
- User messages: White background, right-aligned
- Assistant messages: Semi-transparent black, left-aligned
- Avatar icons for both user and assistant
- Fixed input box at bottom
- Loading spinner during API calls

## 🔌 API Integration

### Current: Mock Endpoint
```typescript
POST /api/chat
Body: { message: string }
Response: { reply: string }
```

### Future: RAG Backend
The mock endpoint documents how to connect to the real RAG pipeline:

```typescript
// Future implementation:
// 1. Generate embedding for user query
const embedding = await openai.embeddings.create({
  input: message,
  model: "text-embedding-3-large"
});

// 2. Query Pinecone for relevant chunks
const results = await pineconeIndex.query({
  vector: embedding,
  topK: 5,
  includeMetadata: true
});

// 3. Construct prompt with context
const context = results.matches
  .map(m => m.metadata.content)
  .join("\n\n");

// 4. Generate response with GPT-4
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Context:\n${context}\n\nQuery: ${message}` }
  ]
});

// 5. Return with citations
return {
  reply: response.choices[0].message.content,
  citations: results.matches.map(m => ({
    title: m.metadata.title,
    url: m.metadata.url
  }))
};
```

## 🎨 Styling Notes

- **Background**: Fixed attachment moon image from Cloudflare R2
- **Dark theme**: Semi-transparent blacks with backdrop blur
- **Typography**: Inter font (Next.js default)
- **Colors**:
  - User messages: White (#ffffff)
  - Assistant messages: Black/60 with border
  - Primary buttons: White text on black
  - Disabled state: Gray with reduced opacity

## 📦 Dependencies

```json
{
  "next": "^16.0.0",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "typescript": "^5.9.3",
  "tailwindcss": "^4.1.16",
  "lucide-react": "^0.547.0",
  "@radix-ui/react-slot": "^1.2.3",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.3.1"
}
```

## 🔜 Next Steps: Backend Integration

### 1. Set up Environment Variables
Create `.env.local`:
```bash
OPENAI_API_KEY=your_openai_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=us-east1-gcp
PINECONE_INDEX=wordpress-archive
```

### 2. Install RAG Dependencies
```bash
npm install openai @pinecone-database/pinecone
```

### 3. Create RAG Utilities
```typescript
// lib/rag.ts
export async function queryKnowledgeBase(message: string) {
  // Implement embedding + Pinecone query + GPT generation
}
```

### 4. Update API Route
Replace mock responses in `app/api/chat/route.ts` with real RAG calls:
```typescript
import { queryKnowledgeBase } from "@/lib/rag";

export async function POST(request: NextRequest) {
  const { message } = await request.json();
  const result = await queryKnowledgeBase(message);
  return NextResponse.json(result);
}
```

### 5. Add Citations Display
Update `ruixen-moon-chat.tsx` to display article citations below assistant messages.

### 6. Implement Streaming (Optional)
Use Vercel AI SDK for streaming responses:
```bash
npm install ai
```

## 🧪 Testing the Mock

The mock API returns different responses based on keywords:
- "discipline" → Articles about discipline and self-control
- "stoicism" → Stoic philosophy content and podcasts
- "productivity" → Productivity systems and time management
- "fitness" → Workout routines and training programs
- Default → General archive introduction

## 📝 Notes

- Component uses "use client" directive (required for React hooks)
- All styles are Tailwind-based (no external CSS files)
- TypeScript strict mode enabled
- No external state management (uses React useState)
- No authentication (add in future phases)
- Background image hosted on Cloudflare R2

## 🎯 Success Criteria

✅ User can send their first message
✅ View transitions to chat interface
✅ Assistant responds with relevant content
✅ User can send follow-up messages
✅ Loading states provide feedback
✅ Keyboard shortcuts work (Enter to send)
✅ UI is responsive and polished
✅ Code is well-commented and typed

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm run build
vercel deploy
```

### Other Platforms
The app is a standard Next.js 15 App Router project and can be deployed to any platform supporting Next.js (Netlify, AWS Amplify, etc.).

---

**Built with:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
**For:** Private Knowledge GPT - Brett McKay Archive Project
