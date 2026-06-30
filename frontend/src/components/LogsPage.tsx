'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, RefreshCw, Search, Wifi, Sparkles } from 'lucide-react';
import { useEnv } from '@/app/page';
import AskLookingGlassModal from './AskLookingGlassModal';

interface LogLine {
  _time?: string;
  _msg?: string;
  'fields.severity'?: string;
  'fields.level'?: string;
  'tags.appname'?: string;
  'tags.host'?: string;
  [key: string]: unknown;
}

const TIME_RANGES = [
  { label: '15m', ms: 15 * 60 * 1000 },
  { label: '1h',  ms: 60 * 60 * 1000 },
  { label: '6h',  ms: 6 * 60 * 60 * 1000 },
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
];

function detectLevel(line: LogLine): 'error' | 'warn' | 'info' | 'debug' | 'unknown' {
  const raw = (
    line['fields.severity'] || line['fields.level'] || ''
  ).toLowerCase();
  if (raw.includes('err') || raw.includes('fatal') || raw.includes('crit')) return 'error';
  if (raw.includes('warn'))  return 'warn';
  if (raw.includes('debug')) return 'debug';
  if (raw.includes('info'))  return 'info';
  // fall back to keyword scan of message
  const msg = (line._msg || '').toLowerCase();
  if (msg.includes('error') || msg.includes('fatal')) return 'error';
  if (msg.includes('warn'))  return 'warn';
  if (msg.includes('debug')) return 'debug';
  return 'unknown';
}

const LEVEL_BADGE: Record<string, string> = {
  error:   'bg-red-500/20 text-red-300',
  warn:    'bg-amber-500/20 text-amber-300',
  info:    'bg-zinc-700 text-zinc-300',
  debug:   'bg-blue-500/20 text-blue-300',
  unknown: 'bg-zinc-800 text-zinc-500',
};
const LEVEL_LABEL: Record<string, string> = {
  error: 'ERROR', warn: 'WARN', info: 'INFO', debug: 'DEBUG', unknown: '—',
};

function buildVlUrl(node: string, timestamp: string): string {
  const vlBase = process.env.NEXT_PUBLIC_VICTORIALOGS_URL || 'http://192.168.0.100:9428';
  const ts   = new Date(timestamp).getTime();
  const from = ts - 5 * 60 * 1000;
  const to   = ts + 5 * 60 * 1000;
  const query = `{tags.host="${node}"}`;
  return `${vlBase}/select/vmui/#/?query=${encodeURIComponent(query)}&from=${from}&to=${to}`;
}

export default function LogsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  const { activeEnv, availableHosts } = useEnv();

  const [logs, setLogs]         = useState<LogLine[]>([]);
  const [loading, setLoading]   = useState(false);
  const [host, setHost]         = useState('');
  const [appname, setAppname]   = useState('');
  const [q, setQ]               = useState('');
  const [rangeIdx, setRangeIdx] = useState(1); // default 1h
  const [live, setLive]         = useState(false);
  const [appNames, setAppNames] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ask the Looking Glass modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<any>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const now   = Date.now();
      const start = now - TIME_RANGES[rangeIdx]!.ms;
      const params = new URLSearchParams({ limit: '200', start: String(start), end: String(now) });
      if (host)    params.set('host', host);
      if (appname) params.set('appname', appname);
      if (q)       params.set('q', q);

      const res  = await fetch(`${apiUrl}/api/v1/logs?${params}`);
      const data = await res.json();
      const lines: LogLine[] = data.logs || [];
      setLogs(lines);

      // Derive unique appnames for filter dropdown
      const names = [...new Set(lines.map(l => l['tags.appname'] as string).filter(Boolean))].sort();
      setAppNames(names);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, host, appname, q, rangeIdx]);

  // Initial + filter-change fetch
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Live refresh
  useEffect(() => {
    if (!live) return;
    const id = setInterval(fetchLogs, 10_000);
    return () => clearInterval(id);
  }, [live, fetchLogs]);

  // When the active environment changes, reset host to first env node (or blank for "all")
  useEffect(() => {
    if (activeEnv && activeEnv.hostnames.length > 0) {
      setHost(activeEnv.hostnames[0]!);
    } else if (!activeEnv) {
      setHost('');
    }
  }, [activeEnv?.id]);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQ(searchInput), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <div className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center px-8 shrink-0 gap-3">
        <span className="text-sm text-zinc-400">App Logs</span>
        {activeEnv && (
          <span className="text-xs text-zinc-600">
            / <span className="text-zinc-400">{activeEnv.name}</span>
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 px-8 py-4 border-b border-zinc-800 bg-zinc-950 shrink-0">
        {/* Node filter — filtered by active environment if set */}
        <select
          value={host}
          onChange={e => setHost(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Nodes</option>
          {(activeEnv ? activeEnv.hostnames : availableHosts).map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>

        {/* App name filter */}
        <select
          value={appname}
          onChange={e => setAppname(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Apps</option>
          {appNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        {/* Keyword search */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 flex-1 min-w-48">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none w-full"
          />
        </div>

        {/* Time range */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {TIME_RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rangeIdx === i
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Live toggle */}
        <button
          onClick={() => setLive(l => !l)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            live
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Wifi className={`w-4 h-4 ${live ? 'animate-pulse' : ''}`} />
          Live
        </button>

        {/* Manual refresh */}
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <span className="text-xs text-zinc-600 ml-auto">{logs.length} lines</span>
      </div>

      {/* Log stream */}
      <div className="flex-1 overflow-y-auto px-8 py-4 font-mono text-xs">
        {loading && logs.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-indigo-500" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-zinc-600 italic">No logs found for the selected filters.</p>
        ) : (
          <div className="space-y-0.5">
            {logs.map((line, i) => {
              const level   = detectLevel(line);
              const ts      = line._time ? new Date(line._time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
              const app     = (line['tags.appname'] as string) || '—';
              const node    = (line['tags.host'] as string) || '';
              const msg     = (line._msg || JSON.stringify(line)) as string;
              const vlUrl   = line._time && node ? buildVlUrl(node, line._time as string) : null;

              return (
                <div key={i} className="group flex items-start gap-3 py-0.5 hover:bg-zinc-900/40 rounded px-1 transition-colors">
                  <span className="text-zinc-600 shrink-0 w-20 tabular-nums">{ts}</span>
                  <span className={`shrink-0 w-12 text-center rounded px-1 py-0 text-[10px] font-bold uppercase ${LEVEL_BADGE[level]}`}>
                    {LEVEL_LABEL[level]}
                  </span>
                  <span className="text-indigo-400/70 shrink-0 w-24 truncate">{app}</span>
                  <span className="flex-1 text-zinc-300 break-all leading-relaxed">{msg}</span>
                  <div className="opacity-0 group-hover:opacity-100 shrink-0 flex items-center gap-1.5 transition-opacity">
                    <button
                      onClick={() => {
                        setModalContext({
                          _time: line._time,
                          _msg: msg,
                          level: level,
                          app: app,
                          node: node,
                        });
                        setModalOpen(true);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      title="Ask the Looking Glass to troubleshoot this log line"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    {vlUrl && (
                      <a
                        href={vlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in VictoriaLogs"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-400 hover:text-indigo-300" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AskLookingGlassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        contextType="log"
        payload={modalContext}
      />
    </div>
  );
}
