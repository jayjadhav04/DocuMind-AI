'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, BookOpen, FlaskConical, UserCheck, Briefcase, 
  Send, Loader2, RefreshCw, ChevronDown, ChevronUp, Search, MessageSquare, AlertCircle,
  Volume2, VolumeX, Mic, MicOff, Copy, Check, FileText
} from 'lucide-react';
import { Chunk, Citation, AI_MODES, searchSimilarChunks } from '@/lib/rag';
import { generateClientEmbedding } from '@/lib/embed';
import Markdown from '@/components/markdown';

interface ChatProps {
  chunks: Chunk[];
  onQuestionAsked: () => void;
  darkMode: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface SearchResultItem {
  docName: string;
  pageNum: number;
  text: string;
  similarity: number;
}

export default function Chat({ chunks, onQuestionAsked, darkMode }: ChatProps) {
  const [activeMode, setActiveMode] = useState<string>('universal');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'chat' | 'search'>('chat'); // chat or semantic search
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  
  // TTS (Text-to-Speech) State
  const [activeSpeakingMessageIndex, setActiveSpeakingMessageIndex] = useState<number | null>(null);
  
  // STT (Speech-to-Text) State
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  
  // Clipboard Copy State
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  
  // Interactive Citation Highlighting State
  const [highlightedCitation, setHighlightedCitation] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, searchResults]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputValue(prev => {
            const newVal = prev ? `${prev} ${transcript}` : transcript;
            // Adjust textarea height on voice input
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
              }
            }, 50);
            return newVal;
          });
        };

        rec.onerror = (e: any) => {
          console.error('Speech recognition error:', e);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        setRecognition(rec);
      }
    }
  }, []);

  const modeDetails = AI_MODES[activeMode];

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    onQuestionAsked();

    if (viewMode === 'search') {
      await performSemanticSearch(text);
      return;
    }

    // Conversational Chat Mode
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      let contextText = '';
      let citations: Citation[] = [];

      if (chunks.length > 0) {
        // Strategy 1: Generate query embedding locally in the browser
        const queryEmbedding = await generateClientEmbedding(text);
        
        // Execute Cosine Similarity search locally over the cached chunk vector array
        const topMatches = searchSimilarChunks(queryEmbedding, chunks, 5);

        contextText = topMatches
          .map((match, idx) => `[Source ID ${idx + 1}] Document: ${match.chunk.docName}, Page: ${match.chunk.pageNum}\nContent snippet: ${match.chunk.text}`)
          .join('\n\n');

        citations = topMatches.map(match => ({
          docName: match.chunk.docName,
          pageNum: match.chunk.pageNum,
          textSnippet: match.chunk.text,
        }));
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          contextText: contextText,
          citations: citations,
          mode: activeMode,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          citations: data.citations || citations,
        },
      ]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Error:** ${err.message || 'Failed to generate response. Please check that GOOGLE_API_KEY is configured.'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const performSemanticSearch = async (query: string) => {
    if (chunks.length === 0) {
      alert('Please upload documents first to search semantically!');
      return;
    }
    setInputValue('');
    setIsLoading(true);
    setSearchResults([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      // 100% offline semantic search using local browser embeddings
      const queryEmbedding = await generateClientEmbedding(query);
      const topMatches = searchSimilarChunks(queryEmbedding, chunks, 5);

      const results = topMatches.map((match) => ({
        docName: match.chunk.docName,
        pageNum: match.chunk.pageNum,
        text: match.chunk.text,
        similarity: match.similarity,
      }));

      setSearchResults(results);
    } catch (err: any) {
      console.error('Search error:', err);
      alert(`Semantic search failed: ${err.message || 'Error processing local vectors'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setSearchResults([]);
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
    setActiveSpeakingMessageIndex(null);
  };

  // Render correct icon for each mode
  const renderModeIcon = (modeId: string, sizeClass = 'w-5 h-5') => {
    switch (modeId) {
      case 'studymate': return <BookOpen className={sizeClass} />;
      case 'researchmind': return <FlaskConical className={sizeClass} />;
      case 'resumevault': return <UserCheck className={sizeClass} />;
      case 'businessinsight': return <Briefcase className={sizeClass} />;
      default: return <Globe className={sizeClass} />;
    }
  };

  // Toggle reading the assistant text aloud
  const handleToggleSpeak = (index: number, text: string) => {
    if (typeof window === 'undefined') return;

    if (activeSpeakingMessageIndex === index) {
      window.speechSynthesis.cancel();
      setActiveSpeakingMessageIndex(null);
      return;
    }

    // Stop ongoing speech
    window.speechSynthesis.cancel();

    // Strip markdown formatting & citation tags for a cleaner reading voice
    const cleanText = text
      .replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '') // Remove [1]
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold stars
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic stars
      .replace(/`([^`]+)`/g, '$1') // Remove inline code ticks
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => {
      setActiveSpeakingMessageIndex(null);
    };
    utterance.onerror = () => {
      setActiveSpeakingMessageIndex(null);
    };

    setActiveSpeakingMessageIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  // Copy message to clipboard
  const handleCopyMessage = async (index: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex(null), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  // Clicking an inline citation card scrolls to the source details and highlights it
  const handleCitationClick = (messageIdx: number, citationNum: number) => {
    const highlightKey = `${messageIdx}-${citationNum}`;
    setHighlightedCitation(highlightKey);

    // Scroll to citation card at the bottom of the bubble
    const targetElementId = `cit-${messageIdx}-${citationNum}`;
    setTimeout(() => {
      const element = document.getElementById(targetElementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);

    // Auto-fade highlight state after 3 seconds
    setTimeout(() => {
      setHighlightedCitation(null);
    }, 3000);
  };

  // Toggle Speech recognition
  const handleToggleListen = () => {
    if (!recognition) {
      alert('Speech-to-text recognition is not supported in this browser. Try using Google Chrome.');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  // Adjust textarea height as text is written
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  return (
    <div className={`flex flex-col h-full rounded-2xl p-6 ${darkMode ? 'glassmorphism text-white' : 'glassmorphism-light text-slate-800'} transition-all duration-300 shadow-xl border border-slate-200 dark:border-slate-800`}>
      
      {/* Mode Selection Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-6">
        {Object.values(AI_MODES).map((mode) => (
          <button
            key={mode.id}
            onClick={() => {
              setActiveMode(mode.id);
              resetChat();
            }}
            className={`p-3 rounded-xl flex flex-col items-center justify-center text-center transition-all duration-200 border ${
              activeMode === mode.id
                ? darkMode
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200'
                  : 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md'
                : darkMode
                  ? 'border-slate-850 hover:border-slate-700 hover:bg-white/5 text-slate-300'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-500/5 text-slate-600'
            }`}
          >
            {renderModeIcon(mode.id, 'w-6 h-6 mb-2')}
            <span className="text-xs font-semibold">{mode.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Active Mode Banner */}
      <div className={`p-4 rounded-xl mb-6 border ${
        darkMode ? 'bg-indigo-500/5 border-slate-850' : 'bg-slate-50 border-slate-150'
      }`}>
        <div className="flex items-center gap-2 mb-1">
          {renderModeIcon(activeMode, 'w-4 h-4 text-indigo-500 dark:text-indigo-400')}
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">{modeDetails.role}</span>
        </div>
        <p className="text-xs opacity-80">{modeDetails.description}</p>
      </div>

      {/* View Mode Toggle & Reset */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800/80 pb-3">
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-lg border border-slate-200 dark:border-slate-800/80">
          <button
            onClick={() => { setViewMode('chat'); resetChat(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'chat'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            AI Chat
          </button>
          <button
            onClick={() => { setViewMode('search'); resetChat(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'search'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Semantic Search
          </button>
        </div>

        <button
          onClick={resetChat}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border transition-all ${
            darkMode 
              ? 'border-slate-850 hover:bg-white/5 text-slate-450 hover:text-slate-200' 
              : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
          }`}
        >
          <RefreshCw className="w-3 h-3" />
          Reset Workspace
        </button>
      </div>

      {/* Messages Workspace */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1 mb-4 min-h-[300px]">
        {viewMode === 'chat' ? (
          messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
              <MessageSquare className="w-12 h-12 text-slate-500 mb-3" />
              <p className="font-bold text-sm">Workspace Ready</p>
              <p className="text-xs max-w-xs mt-1">Ask questions or use the mode buttons above to analyze your documents.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3.5 items-start ${
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                } animate-in fade-in-0 slide-in-from-bottom-2 duration-300`}
              >
                {/* Avatar Icon */}
                <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all shadow-md ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-violet-650 to-indigo-600 text-white shadow-indigo-500/15'
                    : darkMode
                      ? 'bg-slate-900 border border-slate-800 text-indigo-400'
                      : 'bg-indigo-50 border border-indigo-100 text-indigo-650'
                }`}>
                  {msg.role === 'user' ? 'U' : renderModeIcon(activeMode, 'w-4 h-4')}
                </div>

                {/* Message Bubble Container */}
                <div className="flex flex-col max-w-[85%] group">
                  
                  {/* Bubble Header metadata */}
                  <div className={`flex items-center gap-2 mb-1 px-1 text-[10px] opacity-60 font-semibold ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}>
                    <span>{msg.role === 'user' ? 'You' : `${modeDetails.name.split(' ')[0]} AI`}</span>
                    <span>•</span>
                    <span>{msg.role === 'user' ? 'Query' : 'Stateless RAG Core'}</span>
                  </div>

                  <div
                    className={`flex flex-col rounded-2xl p-5 text-left transition-all ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-violet-650 to-indigo-600 text-white rounded-tr-none shadow-lg border border-indigo-500/10'
                        : darkMode
                          ? 'bg-slate-900/60 backdrop-blur-md border border-slate-850 rounded-tl-none shadow-md text-slate-200'
                          : 'bg-white border border-slate-200 rounded-tl-none shadow-sm text-slate-800'
                    }`}
                  >
                    {/* Content */}
                    <div className="prose dark:prose-invert max-w-none">
                      {msg.role === 'user' ? (
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <Markdown 
                          content={msg.content} 
                          citations={msg.citations}
                          darkMode={darkMode} 
                          onCitationClick={(num) => handleCitationClick(index, num)} 
                        />
                      )}
                    </div>

                    {/* Tool Bar inside message card */}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-slate-850/60 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopyMessage(index, msg.content)}
                          title="Copy response"
                          className={`p-1.5 rounded-lg transition-all border ${
                            copiedMessageIndex === index 
                              ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-450' 
                              : darkMode 
                                ? 'border-slate-850 hover:bg-white/5 text-slate-400 hover:text-slate-200' 
                                : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {copiedMessageIndex === index ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleToggleSpeak(index, msg.content)}
                          title={activeSpeakingMessageIndex === index ? "Stop reading" : "Read aloud"}
                          className={`p-1.5 rounded-lg transition-all border ${
                            activeSpeakingMessageIndex === index 
                              ? 'bg-indigo-500/10 border-indigo-500/35 text-indigo-400 animate-pulse' 
                              : darkMode 
                                ? 'border-slate-850 hover:bg-white/5 text-slate-400 hover:text-slate-200' 
                                : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Styled citations section at the bottom of the response */}
                    {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-850/60">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                            <FileText className="w-3 h-3" />
                            Sources:
                          </span>
                          
                          {msg.citations.map((cit, cIdx) => {
                            const citNum = cIdx + 1;
                            const highlightKey = `${index}-${citNum}`;
                            const isHighlighted = highlightedCitation === highlightKey;
                            
                            return (
                              <div
                                key={cIdx}
                                id={`cit-${index}-${citNum}`}
                                title={`Page ${cit.pageNum}: "${cit.textSnippet}"`}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[10px] font-medium transition-all duration-300 ${
                                  isHighlighted
                                    ? 'bg-indigo-500/20 border-indigo-400 shadow-md ring-2 ring-indigo-500/20 scale-105 text-indigo-350 dark:text-indigo-300'
                                    : darkMode
                                      ? 'bg-slate-950/60 border-slate-850 hover:bg-slate-900/60 hover:border-slate-800 text-slate-400 hover:text-slate-200'
                                      : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-650 hover:text-slate-800 hover:shadow-sm'
                                }`}
                              >
                                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-indigo-500/20 text-[9px] font-bold">
                                  {citNum}
                                </span>
                                <span className="max-w-[100px] truncate select-none">{cit.docName}</span>
                                <span className="opacity-60 text-[9px]">p.{cit.pageNum}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          /* Semantic Search Results */
          searchResults.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
              <Search className="w-12 h-12 text-slate-500 mb-3" />
              <p className="font-bold text-sm">Semantic Search Engine</p>
              <p className="text-xs max-w-xs mt-1">Submit search queries to view relevant text chunks matched using cosine similarity.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              <p className="text-xs font-semibold opacity-70 mb-2">Top matched document passages:</p>
              {searchResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-indigo-400 truncate max-w-[65%]">📄 {result.docName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 py-0.5 px-2 rounded-full font-bold border border-indigo-500/20">
                        Match: {Math.round(result.similarity * 100)}%
                      </span>
                      <span className="text-xs opacity-75 font-semibold">Page {result.pageNum}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed italic opacity-90">"{result.text}"</p>
                </div>
              ))}
            </div>
          )
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex items-center gap-2.5 text-xs opacity-80 pl-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>AI is matching context and thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length === 0 && searchResults.length === 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold mb-2 opacity-70">Suggested Prompts:</p>
          <div className="flex flex-wrap gap-2">
            {modeDetails.suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputValue(q);
                  handleSendMessage(q);
                }}
                className={`py-2 px-3.5 rounded-xl text-xs transition-all border ${
                  darkMode
                    ? 'border-slate-850 hover:border-slate-600 bg-white/5 hover:bg-white/10 text-indigo-350 font-medium'
                    : 'border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50 text-indigo-700 font-medium'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Auto-Growing Input Box Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputValue);
        }}
        className="relative"
      >
        <div className={`flex flex-col rounded-2xl border transition-all ${
          darkMode 
            ? 'bg-slate-950 border-slate-850 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent' 
            : 'bg-white border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent shadow-sm'
        }`}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(inputValue);
              }
            }}
            placeholder={
              viewMode === 'chat'
                ? chunks.length === 0 
                  ? 'Ask a general AI question...' 
                  : `Ask about uploaded documents in ${modeDetails.name.split(' ')[0]}...`
                : 'Search documents semantically...'
            }
            className={`w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-xs focus:outline-none max-h-[180px] min-h-[44px] ${
              darkMode ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'
            }`}
            style={{ height: 'auto' }}
          />
          
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1.5 border-t border-slate-900/10 dark:border-white/5">
            {/* Input helpers */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleListen}
                title={isListening ? "Stop listening" : "Dictate question"}
                className={`p-1.5 rounded-lg transition-all border ${
                  isListening 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse' 
                    : darkMode 
                      ? 'border-slate-850 hover:bg-white/5 text-slate-400 hover:text-slate-200' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
              
              {inputValue.length > 0 && (
                <span className="text-[10px] text-slate-500 font-semibold select-none">
                  {inputValue.length} chars
                </span>
              )}
            </div>
            
            {/* Submit button */}
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white h-7 px-3.5 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-semibold shadow-md shadow-indigo-500/15"
            >
              <span>{viewMode === 'search' ? 'Search' : 'Send'}</span>
              {viewMode === 'search' ? <Search className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
