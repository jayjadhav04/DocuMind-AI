'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Citation } from '@/lib/rag';

interface MarkdownProps {
  content: string;
  citations?: Citation[];
  onCitationClick?: (citationIndex: number) => void;
  darkMode?: boolean;
}

// Custom code block renderer with terminal styling and copy function
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-880 bg-slate-950 shadow-md">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between bg-slate-900/90 px-4 py-2.5 text-xs text-slate-450 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500/85"></span>
          <span className="h-3 w-3 rounded-full bg-amber-500/85"></span>
          <span className="h-3 w-3 rounded-full bg-emerald-500/85"></span>
          <span className="ml-2 font-mono text-[10px] opacity-75">{language || 'code'}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.2 rounded px-2 py-1 text-[10px] font-medium transition-all hover:bg-white/5 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Area */}
      <div className="max-h-[300px] overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
        <pre className="flex">
          {/* Line Numbers */}
          <span className="select-none pr-4 text-right text-slate-650 font-semibold" style={{ minWidth: '2.5rem' }}>
            {code.split('\n').map((_, i) => (
              <span key={i} className="block">{i + 1}</span>
            ))}
          </span>
          {/* Actual Code */}
          <code className="block flex-1 whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
}

export default function Markdown({ content, citations, onCitationClick, darkMode = true }: MarkdownProps) {
  if (!content) return null;

  // 1. Dynamic normalization of references
  let normalized = content;

  if (citations && citations.length > 0) {
    // Match and replace: (docName.pdf, Page 1) or [docName.pdf, Page 1] or (docName.pdf, Page: 1) or (docName.pdf, Page:1)
    normalized = normalized.replace(/[([]([^\])]+\.pdf),\s*(?:Page|p)\.?:?\s*(\d+)[\])]/gi, (match, docName, pageStr) => {
      const pageNum = parseInt(pageStr, 10);
      const matchIdx = citations.findIndex(c => 
        c.docName.toLowerCase().trim() === docName.toLowerCase().trim() && 
        c.pageNum === pageNum
      );
      if (matchIdx !== -1) {
        return `[${matchIdx + 1}]`;
      }
      return match;
    });

    // Match and replace: (1, Page 1) or [1, Page 1]
    normalized = normalized.replace(/[([](\d+),\s*(?:Page|p)\.?:?\s*\d+[\])]/gi, '[$1]');
  }

  // Pre-process raw text patterns: convert [Source ID X] or [Src X] to clean [X]
  normalized = normalized
    .replace(/\[?Source ID\s*(\d+)\]?/gi, '[$1]')
    .replace(/\[?Src\s*(\d+)\]?/gi, '[$1]');

  // 2. Parse inline styles (bold, italic, inline code, and citations)
  const renderInline = (text: string): React.ReactNode[] => {
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[\d+(?:\s*,\s*\d+)*\])/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const innerText = part.slice(2, -2);
        return (
          <strong key={index} className="font-bold text-indigo-500 dark:text-indigo-300">
            {innerText}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        const innerText = part.slice(1, -1);
        return <em key={index} className="italic text-slate-350">{innerText}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const innerText = part.slice(1, -1);
        return (
          <code
            key={index}
            className="rounded bg-indigo-500/10 px-1 py-0.5 font-mono text-[11px] text-indigo-600 dark:text-indigo-300"
          >
            {innerText}
          </code>
        );
      }
      // Citation badge rendering: [X]
      if (part.startsWith('[') && part.endsWith(']')) {
        const numbersStr = part.slice(1, -1);
        const numbers = numbersStr.split(',').map((n) => parseInt(n.trim(), 10));

        return (
          <span key={index} className="inline-flex gap-0.5 mx-0.5 select-none items-center align-middle">
            {numbers.map((num, nIdx) => {
              if (isNaN(num)) return null;
              return (
                <button
                  key={nIdx}
                  onClick={() => onCitationClick?.(num)}
                  title={`View Source Citation ${num}`}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 shadow-sm transition-all hover:scale-110 hover:bg-indigo-650 hover:text-white dark:hover:bg-indigo-550 dark:hover:text-white active:scale-95 cursor-pointer"
                >
                  {num}
                </button>
              );
            })}
          </span>
        );
      }
      return part;
    });
  };

  // 3. Block parser line-by-line
  const lines = normalized.split('\n');
  const blocks: React.ReactNode[] = [];
  
  let currentBlockType: 'p' | 'ul' | 'ol' | 'code' | 'table' | 'quote' | null = null;
  let codeLines: string[] = [];
  let codeLanguage = '';
  let listItems: string[] = [];
  let tableRows: string[][] = [];
  let quoteLines: string[] = [];
  let paragraphText = '';

  const flushCurrentBlock = (key: number) => {
    if (!currentBlockType) return;

    if (currentBlockType === 'code') {
      blocks.push(
        <CodeBlock
          key={key}
          code={codeLines.join('\n')}
          language={codeLanguage}
        />
      );
      codeLines = [];
      codeLanguage = '';
    } else if (currentBlockType === 'ul') {
      blocks.push(
        <ul key={key} className="list-disc pl-6 my-2 space-y-1.5 text-slate-700 dark:text-slate-200">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    } else if (currentBlockType === 'ol') {
      blocks.push(
        <ol key={key} className="list-decimal pl-6 my-2 space-y-1.5 text-slate-700 dark:text-slate-200">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{renderInline(item)}</li>
          ))}
        </ol>
      );
      listItems = [];
    } else if (currentBlockType === 'table') {
      if (tableRows.length > 0) {
        const headers = tableRows[0];
        const rows = tableRows.slice(2);
        
        blocks.push(
          <div key={key} className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                <tr>
                  {headers.map((h, idx) => (
                    <th key={idx} className="px-4 py-3">{h.trim()}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors odd:bg-transparent even:bg-slate-50/50 dark:even:bg-slate-900/20 text-slate-800 dark:text-slate-200"
                  >
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-3 whitespace-normal align-top leading-normal">
                        {renderInline(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      tableRows = [];
    } else if (currentBlockType === 'quote') {
      blocks.push(
        <blockquote
          key={key}
          className="my-3 border-l-4 border-indigo-500 bg-indigo-500/5 px-4 py-2.5 rounded-r-lg italic text-slate-700 dark:text-slate-300 text-xs leading-relaxed"
        >
          {renderInline(quoteLines.join(' '))}
        </blockquote>
      );
      quoteLines = [];
    } else if (currentBlockType === 'p') {
      if (paragraphText.trim()) {
        blocks.push(
          <p key={key} className="mb-3.5 leading-relaxed text-slate-700 dark:text-slate-200 text-xs">
            {renderInline(paragraphText)}
          </p>
        );
      }
      paragraphText = '';
    }

    currentBlockType = null;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // 1. Code Block
    if (trimmed.startsWith('```')) {
      if (currentBlockType === 'code') {
        flushCurrentBlock(idx);
      } else {
        flushCurrentBlock(idx);
        currentBlockType = 'code';
        codeLanguage = trimmed.slice(3).trim();
      }
      return;
    }

    if (currentBlockType === 'code') {
      codeLines.push(line);
      return;
    }

    // 2. Table Block
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (currentBlockType !== 'table') {
        flushCurrentBlock(idx);
        currentBlockType = 'table';
      }
      const cells = line.split('|').slice(1, -1);
      tableRows.push(cells);
      return;
    }

    // 3. Blockquote
    if (trimmed.startsWith('>')) {
      if (currentBlockType !== 'quote') {
        flushCurrentBlock(idx);
        currentBlockType = 'quote';
      }
      quoteLines.push(trimmed.slice(1).trim());
      return;
    }

    // 4. Unordered List
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (currentBlockType !== 'ul') {
        flushCurrentBlock(idx);
        currentBlockType = 'ul';
      }
      listItems.push(trimmed.substring(2));
      return;
    }

    // 5. Ordered List
    const olMatch = trimmed.match(/^(\d+)\.\s(.*)/);
    if (olMatch) {
      if (currentBlockType !== 'ol') {
        flushCurrentBlock(idx);
        currentBlockType = 'ol';
      }
      listItems.push(olMatch[2]);
      return;
    }

    // 6. Headers
    if (trimmed.startsWith('#')) {
      flushCurrentBlock(idx);
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const text = trimmed.replace(/^#+\s*/, '');
      const headerClasses = [
        '',
        'text-lg font-extrabold text-slate-900 dark:text-white mt-6 mb-3 border-b border-slate-200 dark:border-slate-800 pb-1.5',
        'text-base font-bold text-slate-900 dark:text-white mt-5 mb-2.5',
        'text-sm font-bold text-indigo-500 dark:text-indigo-400 mt-4 mb-2',
        'text-xs font-semibold text-slate-800 dark:text-slate-300 mt-3 mb-1.5',
      ];
      const selectedClass = headerClasses[Math.min(level, 4)];
      blocks.push(
        React.createElement(`h${Math.min(level, 4)}`, { key: idx, className: selectedClass }, renderInline(text))
      );
      return;
    }

    // 7. Empty line
    if (trimmed === '') {
      flushCurrentBlock(idx);
      return;
    }

    // 8. Paragraph
    if (currentBlockType !== 'p') {
      flushCurrentBlock(idx);
      currentBlockType = 'p';
      paragraphText = line;
    } else {
      paragraphText += ' ' + line;
    }
  });

  flushCurrentBlock(lines.length);

  return <div className="space-y-1">{blocks}</div>;
}
