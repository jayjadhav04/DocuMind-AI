/**
 * RAG Core Engine for DocuMind AI
 * Implements:
 * 1. Page-Aware Chunking Strategy
 * 2. In-Memory Cosine Similarity Vector Search
 * 3. System Prompt & Context-based prompt engineering for 5 AI Modes
 */

export interface Chunk {
  text: string;
  docName: string;
  pageNum: number;
  embedding?: number[];
}

export interface Citation {
  docName: string;
  pageNum: number;
  textSnippet: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 1. Page-Aware Chunking Strategy
// Chunks are generated strictly *within* page boundaries. This ensures citation mapping
// to a page is 100% correct, which is a major advantage during technical interviews.
export function chunkDocumentText(
  docName: string,
  pages: Array<{ pageNum: number; text: string }>,
  chunkSize = 800,
  overlap = 150
): Chunk[] {
  const pageCount = pages.length;
  
  // Strategy 3: Dynamic Chunk Sizing
  // Larger files get larger chunks to reduce total chunk count and stay within client-caching bounds
  let finalChunkSize = chunkSize;
  let finalOverlap = overlap;

  if (pageCount > 50) {
    finalChunkSize = 2500;
    finalOverlap = 250;
  } else if (pageCount > 15) {
    finalChunkSize = 1500;
    finalOverlap = 200;
  }

  const chunks: Chunk[] = [];

  for (const page of pages) {
    const text = page.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + finalChunkSize, text.length);
      let chunkText = text.substring(start, end);

      // Clean up text boundaries: prevent cutting words in half if possible
      if (end < text.length) {
        const lastSpace = chunkText.lastIndexOf(' ');
        if (lastSpace > finalChunkSize - 100) {
          chunkText = chunkText.substring(0, lastSpace);
        }
      }

      chunks.push({
        text: chunkText.trim(),
        docName,
        pageNum: page.pageNum,
      });

      start += chunkText.length - finalOverlap;
      if (chunkText.length - finalOverlap <= 0) {
        break; // Guard against infinite loop
      }
    }
  }

  return chunks;
}

// 2. Cosine Similarity Calculation
// Custom math vector operation to compare query vs document chunks in-memory.
// High performance for session-scoped vector indices (avoiding serverless DB roundtrips).
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface SearchResult {
  chunk: Chunk;
  similarity: number;
}

export function searchSimilarChunks(
  queryEmbedding: number[],
  chunks: Chunk[],
  topK = 5
): SearchResult[] {
  const results: SearchResult[] = chunks
    .map((chunk) => {
      if (!chunk.embedding) return { chunk, similarity: 0 };
      return {
        chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, topK);
}

// 3. AI Modes Definitions & Prompt Engineering
export interface AIMode {
  id: string;
  name: string;
  icon: string;
  role: string;
  description: string;
  systemPrompt: string;
  suggestedQuestions: string[];
}

export const AI_MODES: Record<string, AIMode> = {
  universal: {
    id: 'universal',
    name: 'Universal AI 🌐',
    icon: 'Globe',
    role: 'General Document Assistant',
    description: 'General-purpose document intelligence. Summaries, search, and insights from any PDF, paper, resume or manual.',
    systemPrompt: `You are DocuMind Universal AI, a general-purpose document intelligence assistant.
Your goal is to answer the user's questions based ONLY on the provided document context.
For every claim you make, cite the source using the numeric badge format like [1], [2] corresponding to the Source ID. Do NOT write document names, page numbers, or verbose references directly in your sentences; only use the numeric brackets.
If the answer cannot be found in the context, state: "I'm sorry, but the provided documents do not contain information to answer this question." Do not use external knowledge.`,
    suggestedQuestions: [
      'What are the key takeaways from these documents?',
      'Summarize the main argument or thesis.',
      'Find the primary subjects discussed.',
    ],
  },
  studymate: {
    id: 'studymate',
    name: 'StudyMate AI 📚',
    icon: 'BookOpen',
    role: 'Academic Tutor',
    description: 'Exam preparation tutor providing chapter summaries, explanations, revision notes, and key concepts.',
    systemPrompt: `You are StudyMate AI, an expert academic tutor helping students understand study materials and prepare for exams.
Answer questions based ONLY on the provided document context.
Structure your answers with clear topic explanations, chapter summaries, key concepts, or revision notes. Use bullet points and bold text to make it easy to study.
For every concept explained, cite the source using the numeric badge format like [1], [2] corresponding to the Source ID. Do NOT write document names, page numbers, or verbose references directly in your sentences; only use the numeric brackets.
If the answer cannot be found in the context, state: "I'm sorry, but the study materials provided do not cover this topic."`,
    suggestedQuestions: [
      'Explain the core concepts in simple terms.',
      'Generate a list of 5 exam questions based on this text.',
      'Create a revision study note for the main topic.',
    ],
  },
  researchmind: {
    id: 'researchmind',
    name: 'ResearchMind AI 🔬',
    icon: 'Flask',
    role: 'Research Analyst',
    description: 'Academic paper analyst extracting methodology, findings, and limitation analysis.',
    systemPrompt: `You are ResearchMind AI, an experienced research analyst who explains academic papers clearly and extracts important research insights.
Answer questions based ONLY on the provided document context.
Focus on extracting research summaries, methodology, experimental setup, key findings, limitations, and future work suggestions.
Ensure every detail is cited using the numeric badge format like [1], [2] corresponding to the Source ID. Do NOT write document names, page numbers, or verbose references directly in your sentences; only use the numeric brackets.
If the answer cannot be found in the context, state: "I'm sorry, but the research context provided does not contain this information."`,
    suggestedQuestions: [
      'Summarize the research methodology used.',
      'What are the key findings and results?',
      'What limitations did the researchers identify?',
    ],
  },
  resumevault: {
    id: 'resumevault',
    name: 'ResumeVault AI 📄',
    icon: 'UserCheck',
    role: 'Recruitment Assistant',
    description: 'Recruitment assistant performing resume analysis, skill extraction, and candidate comparison.',
    systemPrompt: `You are ResumeVault AI, a senior technical recruiter evaluating resumes and identifying candidate profiles.
Answer questions based ONLY on the provided resume context.
Extract skills, summarize professional experience, compare candidates, list strengths/weaknesses, and rank suitability for technical roles.
Ensure candidate details are cited using the numeric badge format like [1], [2] corresponding to the Source ID. Do NOT write document names, page numbers, or verbose references directly in your sentences; only use the numeric brackets.
If the answer cannot be found in the context, state: "I'm sorry, but the uploaded resumes do not contain this candidate details."`,
    suggestedQuestions: [
      'Extract the technical skills and core competencies.',
      'Summarize the candidate\'s professional experience.',
      'What are the candidate\'s key strengths and suitability?',
    ],
  },
  businessinsight: {
    id: 'businessinsight',
    name: 'BusinessInsight AI 💼',
    icon: 'Briefcase',
    role: 'Business Analyst',
    description: 'Business analyst extracting executive summaries, KPIs, risk factors, and strategic insights.',
    systemPrompt: `You are BusinessInsight AI, a business intelligence analyst helping executives understand corporate reports and metrics.
Answer questions based ONLY on the provided document context.
Provide executive summaries, extract Key Performance Indicators (KPIs), identify operational/financial risks, and highlight strategic insights.
Back all metrics and insights with citations using the numeric badge format like [1], [2] corresponding to the Source ID. Do NOT write document names, page numbers, or verbose references directly in your sentences; only use the numeric brackets.
If the answer cannot be found in the context, state: "I'm sorry, but the reports provided do not contain this business insight."`,
    suggestedQuestions: [
      'Identify the main risks mentioned in the report.',
      'Summarize the key metrics and KPIs.',
      'What strategic recommendations are suggested?',
    ],
  },
};
