'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, X, AlertCircle, RefreshCw, BookOpen, ExternalLink, Terminal } from 'lucide-react';

interface AskLookingGlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextType: 'log' | 'alert' | 'guest';
  payload: any;
}

export default function AskLookingGlassModal({
  isOpen,
  onClose,
  contextType,
  payload,
}: AskLookingGlassModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string>('');
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    setRetryAfter(null);
    try {
      const response = await fetch(`${apiUrl}/api/v1/ask-looking-glass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextType, payload }),
      });
      if (!response.ok) {
        const errData = await response.json();
        if (response.status === 429) {
          setRetryAfter(errData.retryAfter ?? null);
          throw new Error(errData.error || 'Rate limit reached.');
        }
        throw new Error(errData.error || 'Failed to fetch analysis from Looking Glass.');
      }
      const data = await response.json();
      setAnswer(data.answer);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setAnswer('');
      setError(null);
      setRetryAfter(null);
      dialog.showModal();
      fetchAnalysis();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Countdown timer for rate-limit retry
  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return;
    const interval = setInterval(() => {
      setRetryAfter(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryAfter]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  // Fallback backdrop click for browsers without closedby support
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;

        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );

        if (isDialogContent) return;
        dialog.close();
      };

      dialog.addEventListener('click', handleBackdropClick);
      return () => {
        dialog.removeEventListener('click', handleBackdropClick);
      };
    }
  }, [isOpen]);

  // Inline markdown rendering utility
  const parseInlineMarkdown = (text: string): React.ReactNode[] => {
    const regex = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (!part) return null;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="bg-zinc-800/85 border border-zinc-700/50 text-indigo-300 px-1 py-0.5 rounded font-mono text-[11px]">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('[') && part.includes('](')) {
        const closingBracket = part.indexOf(']');
        const label = part.slice(1, closingBracket);
        const url = part.slice(closingBracket + 2, -1);
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline font-medium inline-flex items-center gap-0.5"
          >
            {label}
            <ExternalLink className="w-2.5 h-2.5 inline" />
          </a>
        );
      }
      return part;
    });
  };

  // Block markdown rendering utility
  const parseBlocks = (text: string) => {
    const lines = text.split('\n');
    const blocks: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLang = '';
    let listItems: React.ReactNode[] = [];

    const flushList = (key: number) => {
      if (listItems.length > 0) {
        blocks.push(
          <ul key={`list-${key}`} className="list-disc pl-5 my-3 space-y-1.5 text-zinc-300 text-sm leading-relaxed">
            {listItems}
          </ul>
        );
        listItems = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          const codeText = codeBlockContent.join('\n');
          const lang = codeBlockLang;
          blocks.push(
            <div key={`code-${i}`} className="my-4 rounded-lg overflow-hidden border border-zinc-800/80 bg-zinc-950 font-mono text-xs">
              <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-900 border-b border-zinc-800/60 text-zinc-400">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">{lang || 'code'}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(codeText)}
                  className="hover:text-zinc-200 text-[10px] transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-zinc-300 leading-normal">
                <code>{codeText}</code>
              </pre>
            </div>
          );
          codeBlockContent = [];
        } else {
          flushList(i);
          inCodeBlock = true;
          codeBlockLang = line.trim().slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      const listMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
      if (listMatch) {
        const content = listMatch[2]!;
        listItems.push(
          <li key={`li-${i}`} className="ml-1">
            {parseInlineMarkdown(content)}
          </li>
        );
        continue;
      }

      flushList(i);

      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('#')) {
        const match = trimmed.match(/^(#+)\s+(.*)/);
        if (match) {
          const level = match[1]!.length;
          const headerText = match[2]!;
          const content = parseInlineMarkdown(headerText);
          if (level === 1) {
            blocks.push(<h1 key={`h1-${i}`} className="text-lg font-bold text-zinc-100 mt-5 mb-3 border-b border-zinc-800 pb-2">{content}</h1>);
          } else if (level === 2) {
            blocks.push(<h2 key={`h2-${i}`} className="text-base font-bold text-zinc-100 mt-5 mb-2">{content}</h2>);
          } else {
            const isStep = headerText.toLowerCase().includes('step ');
            blocks.push(
              <h3
                key={`h3-${i}`}
                className={`text-sm font-semibold text-zinc-200 mt-4 mb-2 flex items-center gap-2 ${
                  isStep ? 'bg-indigo-500/10 border border-indigo-500/25 px-3 py-2 rounded-lg text-indigo-300 shadow-sm shadow-indigo-500/5' : ''
                }`}
              >
                {isStep && <Terminal className="w-4 h-4 shrink-0" />}
                {content}
              </h3>
            );
          }
          continue;
        }
      }

      if (trimmed.toLowerCase().startsWith('step ') && trimmed.includes(':')) {
        blocks.push(
          <p key={`p-${i}`} className="my-3 text-sm bg-indigo-500/10 border border-indigo-500/25 px-3 py-2 rounded-lg text-indigo-300 font-semibold leading-relaxed flex items-center gap-2 shadow-sm shadow-indigo-500/5">
            <Terminal className="w-4 h-4 shrink-0" />
            {parseInlineMarkdown(trimmed)}
          </p>
        );
        continue;
      }

      blocks.push(
        <p key={`p-${i}`} className="my-2.5 text-zinc-300 text-sm leading-relaxed">
          {parseInlineMarkdown(line)}
        </p>
      );
    }

    flushList(lines.length);
    return blocks;
  };

  const getContextSummary = () => {
    if (contextType === 'alert') {
      return `Alert: ${payload?.name || 'Active Alert'}`;
    }
    if (contextType === 'log') {
      return `Log line from ${payload?.['tags.host'] || payload?.host || 'system'}`;
    }
    if (contextType === 'guest') {
      return `Metrics for Guest ${payload?.name || payload?.id} (${payload?.type || 'VM/LXC'})`;
    }
    return 'Troubleshooting Context';
  };

  return (
    <dialog
      ref={dialogRef}
      className="p-0 border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl rounded-2xl max-w-2xl w-[90vw] md:w-full max-h-[85vh] focus:outline-none overflow-hidden shadow-2xl shadow-black/80"
      {...({ closedby: 'any' } as any)}
    >
      <div className="flex flex-col h-full max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Ask the Looking Glass</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Gemini Troubleshooting Assistant</p>
            </div>
          </div>
          <button
            onClick={() => dialogRef.current?.close()}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target context badge */}
          <div className="px-4 py-2 bg-zinc-900/50 border border-zinc-800/40 rounded-xl flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-medium">Context:</span>
            <span className="text-zinc-300 font-mono truncate max-w-[70%]">{getContextSummary()}</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin" style={{ animationDuration: '0.8s' }} />
                <div className="absolute w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm text-zinc-300 font-medium animate-pulse">Looking into the Glass...</p>
                <p className="text-xs text-zinc-500">Consulting official documentation & system states</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
              <div className={`p-3 rounded-full border ${retryAfter !== undefined && retryAfter !== null ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <p className="text-sm font-semibold text-zinc-200">Failed to analyze context</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
              </div>
              {retryAfter !== null ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-amber-400/80">Retrying in <span className="font-mono font-bold">{retryAfter}s</span>…</p>
                  <button
                    onClick={fetchAnalysis}
                    disabled={retryAfter > 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 rounded-lg transition-colors border border-zinc-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Try Again
                  </button>
                </div>
              ) : (
                <button
                  onClick={fetchAnalysis}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors border border-zinc-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
              )}
            </div>
          ) : (
            <div className="prose prose-invert max-w-none text-zinc-300">
              {answer ? parseBlocks(answer) : (
                <p className="text-xs text-zinc-500 italic">No troubleshooting guidance returned.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-900 border-t border-zinc-800/80 flex items-center justify-between shrink-0 text-xs text-zinc-500">
          <div className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
            <span>Stepped investigation approach</span>
          </div>
          <button
            onClick={() => dialogRef.current?.close()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </dialog>
  );
}
