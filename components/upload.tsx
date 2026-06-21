'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Chunk, chunkDocumentText } from '@/lib/rag';
import { generateClientEmbedding } from '@/lib/embed';

interface UploadProps {
  onUploadSuccess: (chunks: Chunk[], stats: { documentsCount: number; pagesCount: number; chunksCount: number }) => void;
  onSummaryGenerated: (summaryData: { summary: string; keyTopics: string[]; keywords: string[]; insights: string[] }) => void;
  darkMode: boolean;
}

interface UploadedFile {
  name: string;
  size: number;
  pages: number;
  status: 'idle' | 'parsing' | 'embedding' | 'success' | 'error';
  error?: string;
}

// Extend global Window object to support PDF.js loaded via CDN script
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export default function Upload({ onUploadSuccess, onSummaryGenerated, darkMode }: UploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  
  // Local model loading & embedding progress states
  const [embedProgress, setEmbedProgress] = useState<{ current: number; total: number } | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load pdfjs-dist dynamically from CDN to bypass server-side Node native compiling issues on Vercel
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.pdfjsLib) {
        setPdfLibLoaded(true);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          setPdfLibLoaded(true);
        }
      };
      document.head.appendChild(script);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  // PDF Text Extraction & RAG Embedding Pipeline
  const processFiles = async (fileList: File[]) => {
    const pdfFiles = fileList.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) return;

    if (!pdfLibLoaded) {
      alert('PDF Parser library is still loading. Please wait a few seconds.');
      return;
    }

    setIsProcessing(true);

    const newFilesState = pdfFiles.map(f => ({
      name: f.name,
      size: f.size,
      pages: 0,
      status: 'parsing' as const,
    }));
    
    setFiles(prev => [...prev, ...newFilesState]);

    const allDocData: Array<{ name: string; pages: Array<{ pageNum: number; text: string }> }> = [];
    let combinedText = '';

    for (let index = 0; index < pdfFiles.length; index++) {
      const file = pdfFiles[index];
      const filename = file.name;

      try {
        // Read file contents as ArrayBuffer
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });

        // Initialize PDF Document via pdf.js CDN Library
        const typedarray = new Uint8Array(arrayBuffer);
        const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
        const pageCount = pdf.numPages;

        // Update parsed pages count in UI status
        setFiles(prev => prev.map(f => f.name === filename ? { ...f, pages: pageCount, status: 'embedding' } : f));

        const pagesText: Array<{ pageNum: number; text: string }> = [];

        // Extract Text page by page
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          pagesText.push({ pageNum: i, text: pageText });
          combinedText += `\n${pageText}`;
        }

        allDocData.push({ name: filename, pages: pagesText });
      } catch (err: any) {
        console.error('Error parsing PDF:', err);
        setFiles(prev => prev.map(f => f.name === filename ? { ...f, status: 'error', error: err?.message || 'Parsing failed' } : f));
      }
    }

    if (allDocData.length === 0) {
      setIsProcessing(false);
      return;
    }

    try {
      // Strategy 3: Chunk text pages using dynamic sizing rules based on file size
      const allChunks: Chunk[] = [];
      for (const doc of allDocData) {
        const docChunks = chunkDocumentText(doc.name, doc.pages);
        allChunks.push(...docChunks);
      }

      if (allChunks.length > 0) {
        setEmbedProgress({ current: 0, total: allChunks.length });

        // Strategy 1: Generate embeddings in browser-side ONNX environment in parallel batches of 5
        const concurrency = 5;
        for (let i = 0; i < allChunks.length; i += concurrency) {
          const batch = allChunks.slice(i, i + concurrency);
          await Promise.all(
            batch.map(async (chunk) => {
              const emb = await generateClientEmbedding(chunk.text, (pct) => {
                setModelLoadProgress(pct);
              });
              chunk.embedding = emb;
              setEmbedProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
              setModelLoadProgress(null);
            })
          );
        }
      }

      setEmbedProgress(null);

      // Update UI file states to success
      setFiles(prev => prev.map(f => {
        if (allDocData.some(d => d.name === f.name)) {
          return { ...f, status: 'success' };
        }
        return f;
      }));

      // Notify parent page of newly loaded chunks
      const totalPages = allDocData.reduce((acc, d) => acc + d.pages.length, 0);
      onUploadSuccess(allChunks, {
        documentsCount: allDocData.length,
        pagesCount: totalPages,
        chunksCount: allChunks.length,
      });

      // Generate AI Summary insights for the sidebar summary panel (retained on server)
      if (combinedText.trim()) {
        const summaryResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'summarize', text: combinedText }),
        });
        const summaryResult = await summaryResponse.json();
        if (summaryResult.success) {
          onSummaryGenerated({
            summary: summaryResult.summary,
            keyTopics: summaryResult.keyTopics,
            keywords: summaryResult.keywords,
            insights: summaryResult.insights,
          });
        }
      }
    } catch (err: any) {
      console.error('Embedding error:', err);
      alert(`Local indexing failed: ${err.message || 'Error loading model'}`);
      setFiles(prev => prev.map(f => f.status === 'embedding' ? { ...f, status: 'error', error: err.message || 'Indexing failed' } : f));
    } finally {
      setEmbedProgress(null);
      setModelLoadProgress(null);
      setIsProcessing(false);
    }
  };

  const clearFiles = () => {
    setFiles([]);
    onUploadSuccess([], { documentsCount: 0, pagesCount: 0, chunksCount: 0 });
  };

  return (
    <div className={`p-6 rounded-2xl ${darkMode ? 'glassmorphism text-white' : 'glassmorphism-light text-slate-800'} transition-all duration-300 shadow-xl`}>
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-indigo-400" />
        Document Sources
      </h3>
      
      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging 
            ? 'border-indigo-500 bg-indigo-500/10' 
            : darkMode 
              ? 'border-slate-700 hover:border-slate-500 hover:bg-white/5' 
              : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-500/5'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf"
          multiple
          className="hidden"
        />
        <UploadCloud className="w-12 h-12 mx-auto mb-3 text-indigo-400 animate-pulse" />
        <p className="font-medium text-sm">Drag & drop your PDFs here, or <span className="text-indigo-400 underline cursor-pointer">browse</span></p>
        <p className={`text-xs mt-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Supports multiple PDFs (max 10MB each)</p>
      </div>

      {/* Upload Progress / List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {files.map((file, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-3 rounded-lg text-xs ${
                darkMode ? 'bg-white/5 border border-slate-850' : 'bg-slate-50 border border-slate-100'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="truncate pr-2">
                  <p className="font-semibold truncate">{file.name}</p>
                  <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB • {file.pages > 0 ? `${file.pages} pages` : 'Pending'}
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {file.status === 'parsing' && (
                  <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Parsing...
                  </span>
                )}
                {file.status === 'embedding' && (
                  <span className="flex flex-col items-end gap-0.5 text-indigo-500 dark:text-indigo-400 font-semibold text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {modelLoadProgress !== null && modelLoadProgress < 100
                        ? `AI Model Loading (${modelLoadProgress}%)`
                        : embedProgress
                          ? `Local Indexing (${embedProgress.current}/${embedProgress.total})`
                          : 'Vectorizing...'}
                    </span>
                  </span>
                )}
                {file.status === 'success' && (
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                  </span>
                )}
                {file.status === 'error' && (
                  <span className="flex items-center gap-1 text-rose-400 font-semibold" title={file.error}>
                    <AlertCircle className="w-3.5 h-3.5" /> Error
                  </span>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={clearFiles}
            disabled={isProcessing}
            className={`w-full mt-2 py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-medium text-xs border transition-all ${
              darkMode 
                ? 'border-slate-800 hover:bg-red-500/10 text-slate-300 hover:text-red-455' 
                : 'border-slate-200 hover:bg-red-50 text-slate-600 hover:text-red-600'
            } disabled:opacity-50`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Sources
          </button>
        </div>
      )}
    </div>
  );
}
