# DocuMind AI • Stateless Browser RAG Core

**"Upload Documents. Search Smarter. Get Source-Based Answers — Powered by Wasm Client-Side Retrievals."**

DocuMind AI is a production-ready, high-fidelity Document Intelligence Platform built with Next.js 15, React 19, TypeScript, and Tailwind CSS. It implements a unique database-free **Stateless RAG Architecture** that runs the embedding model and vector search entirely in the user's browser, completely avoiding Vercel payload constraints, eliminating database costs, and preventing Google Gemini API key rate-limiting (429) errors.

---

## 🏗️ Architecture Design & Flow

Unlike traditional RAG applications that rely on heavy server-side processing, API embedding endpoints, and costly cloud vector databases, DocuMind AI utilizes a hybrid **Client-Side Retrieval (Local RAG)** architecture. 

### Vector Indexing & Retrieval Pipeline:

```mermaid
flowchart TD
    %% Upload Flow
    subgraph Browser Client (Indexing)
        A[User Uploads PDF] --> B[Extract Text via Mozilla PDF.js CDN]
        B --> C[Page-Aware Overlap Chunking]
        C --> D[Adaptive Dynamic Sizing Logic]
        D -->|Parallel Batches of 5| E[Browser-Side ONNX Embedding Generator]
        E -->|Xenova/all-MiniLM-L6-v2| F[(IndexedDB Model Cache)]
        E -->|384-Dim Vectors| G[(React State Vector Store)]
    end

    %% Query Flow
    subgraph Browser Client (Query & Retrieval)
        H[User Types Question] --> I[Embed Query locally via ONNX]
        I --> J[Run Cosine Similarity Search Offline]
        J -->|Top 5 Context Match| K[Construct Context Text payload]
    end

    %% Completion Flow
    subgraph Serverless API (Completion)
        K -->|Stateless Request| L[Next.js API Route /api/chat]
        L -->|Constraint Prompts| M[Google Gemini 2.5 Flash]
        M -->|JSON/Markdown Response| N[Stateless Answer + Citations]
    end

    N -->|Render UI| O[User views source-cited Answer]
```

---

## 🚀 Key Innovation Highlights

### ⚡ Strategy 1: Browser-Side ONNX Embeddings
By utilizing `@xenova/transformers` loaded dynamically from JSDelivr, the embedding generation model is executed locally in WebAssembly.
* **IndexedDB Caching**: The model (~30MB) is downloaded once on the first file upload and cached in the browser's IndexedDB. Subsequent page loads take `< 100ms` and require **0 MB** of network data.
* **0 Cost / Unlimited Scale**: Eliminates external server-side embedding API calls entirely, making the app 100% immune to Google API key rate limits (429 errors).

### 📐 Strategy 3: Adaptive Page-Aware Chunking
Text is split into overlapping chunks strictly within page boundaries to ensure citation accuracy. The chunk size automatically scales dynamically based on the document's total page count:
* **Short Documents (< 15 pages)**: Chunk size of `800` characters (highly detailed search resolution).
* **Medium Documents (15 - 50 pages)**: Chunk size of `1500` characters.
* **Heavy Documents (> 50 pages)**: Chunk size of `2500` characters.
* This dynamic adjustment prevents the browser from running out of memory when processing large files (e.g. 100+ page manuals) and keeps cosine similarity searches lightning-fast.

---

## ✨ Features

* **📁 Multi-PDF Upload**: Upload multiple PDFs at once. Real-time indicators display parsing status and local vectorization progress.
* **📚 5 Tailored AI Persona Modes**:
  * **Universal AI 🌐**: General document intelligence, summaries, and Q&A.
  * **StudyMate AI 📚**: Academic revision notes, flashcard concepts, and practice questions.
  * **ResearchMind AI 🔬**: Extracts methodology, core findings, and limitations from academic papers.
  * **ResumeVault AI 📄**: HR assistant that parses resume skills, experience, and candidate highlights.
  * **BusinessInsight AI 💼**: Business analyst highlighting KPIs, executive metrics, and financial risks.
* **🔎 Offline Semantic Search Tab**: Toggle the workspace view to run vector searches locally. Displays matching document passages, page numbers, and cosine similarity matching percentages.
* **🏷️ Interactive Citation Highlighting**: Circular source badges (`[1]`, `[2]`) align text assertions to retrieved passages. Hovering displays the snippet in a tooltip; clicking scrolls the chat viewport and highlights the source detail.
* **📊 Statistics Dashboard**: Displays active workspace metrics (Document count, Page count, Chunks, Embeddings, and Queries asked).
* **🌌 Aurora Backdrop UI**: Slow-drifting blurred ambient light blobs floating behind premium glassmorphic cards.
* **👥 Developer Footer**: Beautiful profile badge with custom hover states referencing developer **Jay Jadhav's** GitHub, LinkedIn, and Portfolio links.

---

## 🛠️ Tech Stack

* **Core**: Next.js 15 (App Router), React 19, TypeScript
* **Styling**: Tailwind CSS, Lucide Icons, Custom CSS Floating Animations
* **Vector Engine**: WebAssembly ONNX Model `all-MiniLM-L6-v2` (via `@xenova/transformers`)
* **Parsing**: Mozilla `pdf.js` library loaded via CDN
* **Text Generation**: Google Gemini 2.5 Flash API (`gemini-2.5-flash`)
* **Deployment**: Vercel

---

## 💻 Local Installation & Setup

### Prerequisites
* Node.js v18.0.0 or higher installed.
* A Google Gemini API Key (obtained from Google AI Studio).

### Setup Instructions
1. Clone the repository and navigate to the project directory:
   ```bash
   cd "d:/Projects/DocuMind AI"
   ```
2. Install the package dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root folder of the project and add your Gemini API Key:
   ```env
   # Add your Gemini API Key below
   GOOGLE_API_KEY=your_gemini_api_key_here
   ```
4. Start the local development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to [http://localhost:3000](http://localhost:3000) (the Next.js server compiles assets and loads).

---

## 🚀 Serverless Deployment Guide

This project is completely database-free and optimized for stateless hosting on **Vercel** with zero database setup required.

1. Deploy the project to Vercel via the Vercel Dashboard or using the CLI:
   ```bash
   vercel
   ```
2. Navigate to your **Vercel Project Settings -> Environment Variables** and add:
   * `GOOGLE_API_KEY`: Your Google Gemini API Key.
3. Deploy! Since the RAG state, embeddings, and vector similarity checks are executed on the client side, your Vercel functions remain stateless, preventing network payload size limits and gateway timeout errors.

---

## 📝 Resume Bullets & Talking Points

If you are showcasing this project on your portfolio or resume, here are ATS-friendly descriptions:

* **Document Intelligence Platform**: Developed a high-fidelity document analysis application using Next.js 15, TypeScript, and Google Gemini 2.5 Flash, enabling context-aware Q&A across multi-PDF uploads.
* **Stateless Browser RAG Architecture**: Designed a serverless-friendly vector retrieval architecture using local ONNX embeddings via WebAssembly, saving 100% of server-side embedding costs and preventing API rate-limiting (429) errors.
* **Adaptive Page-Aware Chunking**: Authored custom page-aware chunking with dynamic character scaling (from 800 to 2500 characters) to optimize browser memory cache limits and ensure 100% accurate page-number citations.
* **Client-Side Cosine Similarity**: Programmed an in-memory vector search engine utilizing cosine similarity calculations, reducing backend network request payloads from megabytes to simple text chunks.
* **Modern Glassmorphic UX**: Implemented a responsive dark-themed UI featuring CSS floating blur animations, interactive pulse-scrolling citations, and specialized AI mode prompting.

---

## 📄 License & Info

Designed & Developed by **Jay Jadhav**. 
* **GitHub**: [github.com/jayjadhav](https://github.com)
* **LinkedIn**: [linkedin.com/in/jayjadhav](https://linkedin.com)
* **Portfolio**: [jayjadhav.dev](https://portfolio.com)
