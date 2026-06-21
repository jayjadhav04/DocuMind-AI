'use client';

import React, { useState, useEffect } from 'react';
import {
  Sun, Moon, FileText, Layers, Hash, BrainCircuit, MessageCircleCode,
  Lightbulb, Sparkles, Key, CheckCircle, BarChart3, HelpCircle,
  Github, Linkedin, Globe
} from 'lucide-react';
import Upload from '@/components/upload';
import Chat from '@/components/chat';
import { Chunk } from '@/lib/rag';

interface SummaryData {
  summary: string;
  keyTopics: string[];
  keywords: string[];
  insights: string[];
}

export default function Home() {
  const [darkMode, setDarkMode] = useState(true);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [stats, setStats] = useState({
    documentsCount: 0,
    pagesCount: 0,
    chunksCount: 0,
    questionsAsked: 0
  });

  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [activeSummaryTab, setActiveSummaryTab] = useState<'summary' | 'topics' | 'insights'>('summary');

  // Sync theme with HTML class and localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isLight = savedTheme === 'light';
    setDarkMode(!isLight);
    if (!isLight) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleUploadSuccess = (
    newChunks: Chunk[],
    newStats: { documentsCount: number; pagesCount: number; chunksCount: number }
  ) => {
    setChunks(newChunks);
    setStats(prev => ({
      ...prev,
      documentsCount: newStats.documentsCount,
      pagesCount: newStats.pagesCount,
      chunksCount: newStats.chunksCount
    }));
    // Clear summary when document index is cleared
    if (newChunks.length === 0) {
      setSummaryData(null);
    }
  };

  const handleQuestionAsked = () => {
    setStats(prev => ({
      ...prev,
      questionsAsked: prev.questionsAsked + 1
    }));
  };

  const handleSummaryGenerated = (data: SummaryData) => {
    setSummaryData(data);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'} transition-colors duration-300`}>

      {/* Decorative Animated Aurora Gradient Background Elements for Premium Feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/10 dark:bg-purple-900/5 blur-[120px] pointer-events-none animate-blob-1" />
      <div className="absolute bottom-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-indigo-500/10 dark:bg-indigo-900/5 blur-[120px] pointer-events-none animate-blob-2" />
      <div className="absolute top-[30%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-blue-500/5 dark:bg-blue-900/5 blur-[120px] pointer-events-none animate-blob-3" />

      {/* App Shell Wrapper */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">

        {/* Header / Brand Banner */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10 pb-6 border-b border-slate-850/50">
          <div>
            <div className="flex items-center gap-3">
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                <BrainCircuit className="w-6 h-6 text-white" />
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className={darkMode ? 'text-gradient' : 'text-gradient-light'}>DocuMind AI</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-400 py-1 px-2.5 rounded-full border border-emerald-500/20 shadow-sm">
                Production Ready
              </span>
            </div>
            <p className={`text-sm mt-1.5 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Upload Documents. Search Smarter. Get Source-Based Answers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className={`p-2.5 rounded-xl border transition-all ${darkMode
                  ? 'border-slate-800 bg-white/5 hover:bg-white/10 text-yellow-400'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-indigo-600 shadow-sm'
                }`}
              title="Toggle Light/Dark Mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className={`hidden md:flex flex-col text-right ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="text-xs font-bold text-slate-300">RAG Portfolio Standard</span>
              <span className="text-[10px] font-mono opacity-75">Stateless RAG Core</span>
            </div>
          </div>
        </header>

        {/* Statistics Dashboard Widget Grid */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className={`p-4 rounded-xl border transition-all ${darkMode ? 'bg-white/5 border-slate-900' : 'bg-white border-slate-200 shadow-sm'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold opacity-70">Documents</span>
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black">{stats.documentsCount}</p>
          </div>

          <div className={`p-4 rounded-xl border transition-all ${darkMode ? 'bg-white/5 border-slate-900' : 'bg-white border-slate-200 shadow-sm'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold opacity-70">Total Pages</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black">{stats.pagesCount}</p>
          </div>

          <div className={`p-4 rounded-xl border transition-all ${darkMode ? 'bg-white/5 border-slate-900' : 'bg-white border-slate-200 shadow-sm'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold opacity-70">Chunks</span>
              <Hash className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black">{stats.chunksCount}</p>
          </div>

          <div className={`p-4 rounded-xl border transition-all ${darkMode ? 'bg-white/5 border-slate-900' : 'bg-white border-slate-200 shadow-sm'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold opacity-70">Embeddings</span>
              <BrainCircuit className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black">{stats.chunksCount > 0 ? stats.chunksCount : 0}</p>
          </div>

          <div className={`p-4 rounded-xl border transition-all col-span-2 md:col-span-1 ${darkMode ? 'bg-white/5 border-slate-900' : 'bg-white border-slate-200 shadow-sm'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold opacity-70">Queries Asked</span>
              <MessageCircleCode className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black">{stats.questionsAsked}</p>
          </div>
        </section>

        {/* Primary Page Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: PDF Uploader & AI Summary Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-6">

            {/* Upload Area */}
            <Upload
              onUploadSuccess={handleUploadSuccess}
              onSummaryGenerated={handleSummaryGenerated}
              darkMode={darkMode}
            />

            {/* AI Summary Panel */}
            {summaryData ? (
              <div className={`p-5 rounded-2xl ${darkMode ? 'glassmorphism text-white' : 'glassmorphism-light text-slate-800'
                } transition-all duration-300 shadow-xl border`}>

                <h3 className="text-md font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
                  AI Summary Panel
                </h3>

                {/* Tab selectors */}
                <div className="flex gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800 mb-4">
                  <button
                    onClick={() => setActiveSummaryTab('summary')}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${activeSummaryTab === 'summary'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Summary
                  </button>
                  <button
                    onClick={() => setActiveSummaryTab('topics')}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${activeSummaryTab === 'topics'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Topics
                  </button>
                  <button
                    onClick={() => setActiveSummaryTab('insights')}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${activeSummaryTab === 'insights'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Insights
                  </button>
                </div>

                {/* Tab content */}
                <div className="max-h-[300px] overflow-y-auto pr-1">
                  {activeSummaryTab === 'summary' && (
                    <div className="text-xs leading-relaxed opacity-90 space-y-2 whitespace-pre-wrap">
                      <p className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5 text-[10px] uppercase text-indigo-400">
                        Executive Summary
                      </p>
                      {summaryData.summary}
                    </div>
                  )}

                  {activeSummaryTab === 'topics' && (
                    <div className="space-y-3">
                      <p className="font-semibold text-slate-300 flex items-center gap-1.5 text-[10px] uppercase text-indigo-400">
                        Key Topics & Keywords
                      </p>
                      <ul className="space-y-1.5">
                        {summaryData.keyTopics.map((topic, idx) => (
                          <li key={idx} className="text-xs flex items-start gap-2">
                            <span className="text-indigo-400 font-bold shrink-0 mt-0.5">•</span>
                            <span className="opacity-90">{topic}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="pt-2 border-t border-slate-800">
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {summaryData.keywords.map((kw, idx) => (
                            <span
                              key={idx}
                              className="text-[9px] bg-indigo-500/10 text-indigo-400 py-1 px-2.5 rounded-full font-bold border border-indigo-500/15"
                            >
                              #{kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSummaryTab === 'insights' && (
                    <div className="space-y-3">
                      <p className="font-semibold text-slate-300 flex items-center gap-1.5 text-[10px] uppercase text-indigo-400">
                        Key Actionable Insights
                      </p>
                      <ul className="space-y-2">
                        {summaryData.insights.map((insight, idx) => (
                          <li key={idx} className="text-xs flex gap-2.5 items-start bg-slate-900/30 p-2.5 rounded-lg border border-slate-850">
                            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <span className="opacity-90 leading-normal">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Idle Summary Panel State */
              <div className={`p-6 rounded-2xl text-center flex flex-col justify-center items-center opacity-65 ${darkMode ? 'glassmorphism text-white' : 'glassmorphism-light text-slate-800'
                }`}>
                <Sparkles className="w-8 h-8 text-indigo-400 mb-2 animate-pulse" />
                <p className="font-bold text-xs">AI Summary Panel</p>
                <p className="text-[10px] max-w-xs mt-1 leading-normal">Upload PDF documents to automatically extract executive summaries, top keywords, key topics, and deep insights here.</p>
              </div>
            )}

          </div>

          {/* Right Column: Chat Workspace */}
          <div className="lg:col-span-8 flex flex-col">
            <Chat
              chunks={chunks}
              onQuestionAsked={handleQuestionAsked}
              darkMode={darkMode}
            />
          </div>

        </div>

        {/* Footer Candidate Note */}
        <footer className={`mt-12 text-center text-xs opacity-75 py-5 border-t border-slate-900/10 dark:border-slate-850/40 flex flex-col md:flex-row items-center justify-between gap-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          <div className="flex items-center gap-2 select-none">
            <span className="font-bold text-slate-800 dark:text-slate-200">DocuMind AI</span>
            <span>•</span>
            <span>Designed & Developed by <strong className="font-semibold text-indigo-650 dark:text-indigo-400">Jay Jadhav</strong></span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://github.com/jayjadhav04" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 font-medium">
              <Github className="w-3.5 h-3.5" /> GitHub
            </a>
            <a href="https://linkedin.com/in/jayjadhav04" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 font-medium">
              <Linkedin className="w-3.5 h-3.5" /> LinkedIn
            </a>
            <a href="https://jay-jadhav-portfolio.vercel.app/" className="hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 font-medium">
              <Globe className="w-3.5 h-3.5" /> Portfolio
            </a>
          </div>
        </footer>

      </div>
    </div>
  );
}
