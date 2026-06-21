# Walkthrough - Stateless Browser RAG Core, Client-Side Embeddings & Visual Polish

This walkthrough documents the comprehensive upgrades made to the **DocuMind AI** platform. We migrated the system from a server-side embedding model to a fully client-side hybrid RAG pipeline combining **Strategy 1 (Browser-Side ONNX Embeddings)** and **Strategy 3 (Dynamic Adaptive Chunk Sizing)**. In addition, we solved dark mode contrast bugs, polished references into a compact layout, and personalized the interface with branding and developer information.

---

## 🚀 Key Improvements & Architecture Migration

### 1. Hybrid Client-Side RAG (Strategies 1 & 3)
* **Problem**: Heavy document processing triggered Google Gemini API rate limits (`[429 Too Many Requests] You exceeded your current quota`) and caused serverless payload overhead when transferring large vector caches.
* **Solution**:
  * **Browser-Side ONNX Embeddings (Strategy 1)**: Embeddings are now generated 100% locally in the browser using the `@xenova/transformers` library running the `all-MiniLM-L6-v2` model (downloaded dynamically via the JSDelivr CDN to bypass Webpack static build limits).
  * **IndexedDB Caching**: The model (~30MB) downloads only on the first upload and is cached natively in the browser's IndexedDB. Subsequent loads take `< 100ms` and require **0 MB** of network data.
  * **Adaptive Chunking (Strategy 3)**: Implemented page-aware chunking that dynamically adjusts chunk sizing based on the document page counts in [lib/rag.ts](file:///d:/Projects/DocuMind%20AI/lib/rag.ts):
    * Documents `< 15 pages`: Chunk Size = `800` chars, overlap = `150` chars
    * Documents `15 - 50 pages`: Chunk Size = `1500` chars, overlap = `200` chars
    * Documents `> 50 pages`: Chunk Size = `2500` chars, overlap = `250` chars
  * **Offline Semantic Search**: Added a custom in-memory cosine similarity matching engine in `lib/rag.ts` that runs offline vector search directly in the browser. The server API `/api/chat` only receives the final pre-retrieved context chunks, preventing Vercel serverless gateway timeouts.

### 2. UI/UX & Visual Enhancements
* **High-Contrast Dark Mode**: Synchronized the page state to `document.documentElement.classList`, fixing the contrast bug where bubble text was unreadable.
* **Animated Aurora Glow**: Injected three blurred ambient color blobs animated with slow CSS keyframe movements drifting behind the main cards.
* **Extremely Compact Citation Pills**: Redesigned bulky citation blocks under assistant bubbles into a single row of tiny badges. Hovering over a badge displays the context text snippet inside a tooltip (`title` attribute). Clicking the badge scrolls to and pulse-highlights the source detail block.
* **Branding (Stateless RAG Core)**: Renamed all user-facing references from "Gemini 2.5 Flash Engine" to "Stateless RAG Core" to reflect the local vector pipeline.
* **Developer footer**: Integrated a beautiful developer footer section for **Jay Jadhav** displaying links with custom hover transitions and icons pointing to **GitHub**, **LinkedIn**, and **Portfolio**.

---

## 🛠️ Files Created & Modified

### `[NEW]` [lib/embed.ts](file:///d:/Projects/DocuMind%20AI/lib/embed.ts)
* Implements Wasm-based local feature-extraction using `@xenova/transformers`. Uses a dynamic Function constructor `Function("return import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0')")` to bypass compile-time Webpack static analysis warnings on Vercel.

### `[MODIFY]` [lib/rag.ts](file:///d:/Projects/DocuMind%20AI/lib/rag.ts)
* Added adaptive sizing logic to `chunkDocumentText` to automatically scale chunk sizing.

### `[MODIFY]` [components/upload.tsx](file:///d:/Projects/DocuMind%20AI/components/upload.tsx)
* Integrates `generateClientEmbedding` inside the PDF parsing loop.
* Shows real-time model loading percentage (`AI Model Loading (45%)`) and progress indicators (`Local Indexing (12/80)`).
* Vectorizes chunks in parallel batches of 5.

### `[MODIFY]` [components/chat.tsx](file:///d:/Projects/DocuMind%20AI/components/chat.tsx)
* Embeds user queries locally using the client-side ONNX model.
* Executes offline similarity search using `searchSimilarChunks` and passes the top 5 chunks to `/api/chat`.
* Includes the compact citation buttons with scroll-and-pulse interaction.

### `[MODIFY]` [app/api/chat/route.ts](file:///d:/Projects/DocuMind%20AI/app/api/chat/route.ts)
* Deprecated the serverless `/api/chat?action=embed` request, turning it into a mocked static success handler.
* Simplified `/api/chat?action=chat` to accept pre-vectorized context chunks directly.

---

## 📸 Screenshots & Verification

### Dark Mode & Citation Layout
![Legibility and Compact Badges](file:///C:/Users/Admin/.gemini/antigravity-ide/brain/2dced83b-f8d8-4d3d-b211-052325faea63/chat_ui_verified_1782039872874.png)

### Developer Footer Profile
![Jay Jadhav Custom Footer](file:///C:/Users/Admin/.gemini/antigravity-ide/brain/2dced83b-f8d8-4d3d-b211-052325faea63/footer_final_verification_1782041026641.png)

---

## 🚀 How to Run Locally
1. Stop your server if running and restart it to refresh webpack cache:
   ```bash
   npm run dev
   ```
2. Navigate to [http://localhost:3000](http://localhost:3000).
3. Upload a PDF. Notice the model download progress indicator.
4. Refresh the page and upload again. The file indexes instantly because the model is cached locally!
5. Ask a question and verify the compact citation references click highlight.
