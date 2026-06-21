import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_MODES, chunkDocumentText, searchSimilarChunks, Chunk } from '@/lib/rag';

// Initialize Gemini SDK with safety fallback
const apiKey = process.env.GOOGLE_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(req: NextRequest) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY is not configured on the server. Please add it to your environment variables.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { action } = body;

    // 1. ACTION: EMBED (Deprecated/Mocked - embeddings are generated locally in browser)
    if (action === 'embed') {
      return NextResponse.json({ success: true, chunks: [] });
    }

    // 2. ACTION: CHAT
    // Receives pre-retrieved context and citations from client, calling Gemini to generate a response.
    if (action === 'chat') {
      const { message, history = [], contextText = '', citations = [], mode = 'universal' } = body;

      if (!message) {
        return NextResponse.json({ error: 'Message query is required' }, { status: 400 });
      }

      const activeMode = AI_MODES[mode] || AI_MODES.universal;

      // If no contextText supplied yet (no documents uploaded), answer from general knowledge
      if (!contextText) {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: message }] }],
        });
        return NextResponse.json({
          success: true,
          answer: result.response.text() + '\n\n*(Note: No documents have been uploaded in this session yet. Answering from general AI knowledge.)*',
          citations: [],
        });
      }

      // Assemble system instructions, retrieved context, chat history, and new query
      const promptText = `
SYSTEM INSTRUCTIONS:
${activeMode.systemPrompt}

Retrieved context from uploaded documents:
${contextText}

Conversation History:
${history.map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}

User Question: ${message}

Remember:
1. Provide a comprehensive, clear response based ONLY on the retrieved context above.
2. Back every claim or detail with the corresponding citation index number in square brackets, e.g. [1], [2], corresponding to the [Source ID X] from the context. Do NOT write document names or page numbers inside the text sentences; only use the [X] citation badge format.
3. If the answer cannot be found in the context, follow your system prompt instructions.
4. Respond in structured Markdown format.
`;

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
      });

      return NextResponse.json({
        success: true,
        answer: result.response.text(),
        citations,
      });
    }

    // 3. ACTION: SUMMARIZE
    // Summarizes document text and outputs structured JSON metadata.
    if (action === 'summarize') {
      const { text } = body;
      if (!text) {
        return NextResponse.json({ error: 'Text content is required for summarization' }, { status: 400 });
      }

      // Bound size to fit within prompt context comfortably
      const textSample = text.substring(0, 35000);

      const promptText = `
You are a document intelligence analyst. Analyze the following document text and return a JSON object with:
1. "summary": A concise executive summary of the document (2-3 paragraphs).
2. "keyTopics": An array of the top 5 key topics covered.
3. "keywords": An array of 6-8 relevant keywords.
4. "insights": An array of 4-5 important actionable insights.

Response must be valid JSON matching this exact structure:
{
  "summary": "...",
  "keyTopics": ["...", "..."],
  "keywords": ["...", "..."],
  "insights": ["...", "..."]
}

Document text:
${textSample}
`;

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const parsedData = JSON.parse(result.response.text());

      return NextResponse.json({
        success: true,
        ...parsedData,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred during API processing.' },
      { status: 500 }
    );
  }
}
