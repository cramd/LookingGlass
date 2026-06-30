'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, XCircle, CheckCircle2, Clock, BellOff, ChevronDown, Sparkles } from 'lucide-react';
import { useEnv } from '@/app/page';
import AskLookingGlassModal from './AskLookingGlassModal';

interface Alert {
  id: string;
  name: string;
  state: 'firing' | 'pending' | 'inactive';
  severity: string;
  summary: string;
  description: string;
  host: string;
  vmid?: string;
  activeAt: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

interface Rule {
  name: string;
  query: string;
  state: string;
  group: string;
  lastEvaluation: string;
}

const SILENCE_DURATIONS = [
  { label: '15 min', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
  { label: '24 hours', minutes: 1440 },
];

function formatDuration(isoStart: string): string {
  const ms = Date.now() - new Date(isoStart).getTime();
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StateBadge({ state }: { state: string }) {
  const s = state.toLowerCase();
  if (s === 'firing')   return <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> FIRING</span>;
  if (s === 'pending')  return <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> PENDING</span>;
  if (s === 'inactive') return <span className="inline-flex items-center gap-1 bg-zinc-700 text-zinc-400 text-xs font-bold px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> OK</span>;
  return <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-500 text-xs font-bold px-2 py-0.5 rounded-full">{state.toUpperCase()}</span>;
}

function SilenceDropdown({ alert, onSilenced }: { alert: Alert; onSilenced: (id: string) => void }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const silence = async (minutes: number) => {
    setLoading(true);
    setOpen(false);
    try {
      await fetch(`${apiUrl}/api/v1/alerts/silence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertname: alert.name,
          labels: alert.labels,
          durationMinutes: minutes,
          comment: `Silenced via Looking Glass UI for ${minutes} min`,
        }),
      });
      setDone(true);
      onSilenced(alert.id);
    } catch {
      setLoading(false);
    }
  };

  if (done) return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-500 px-2 py-1 rounded bg-zinc-800">
      <BellOff className="w-3 h-3" /> Silenced
    </span>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors disabled:opacity-40"
      >
        <BellOff className="w-3 h-3" />
        Silence
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-10 overflow-hidden">
          {SILENCE_DURATIONS.map(d => (
            <button
              key={d.minutes}
              onClick={() => silence(d.minutes)}
              className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  const { activeEnv } = useEnv();
  const [alerts, setAlerts]   = useState<Alert[]>([]);
  const [rules, setRules]     = useState<Rule[]>([]);
  const [silenced, setSilenced] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Ask the Looking Glass modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const [alertsRes, rulesRes] = await Promise.all([
          fetch(`${apiUrl}/api/v1/alerts`),
          fetch(`${apiUrl}/api/v1/alert-rules`),
        ]);

        if (alertsRes.ok) {
          const data = await alertsRes.json();
          const raw: any[] = data.alerts || [];
          setAlerts(raw.map((a: any) => ({
            id: `${a.name}-${a.labels?.host || ''}-${a.labels?.vmid || ''}`,
            name: a.name,
            state: a.state,
            severity: a.labels?.severity || 'warning',
            summary: a.annotations?.summary || a.name,
            description: a.annotations?.description || '',
            host: a.labels?.host || a.labels?.nodename || '—',
            vmid: a.labels?.vmid,
            activeAt: a.activeAt || new Date().toISOString(),
            labels: a.labels || {},
            annotations: a.annotations || {},
          })));
        }

        if (rulesRes.ok) {
          const data = await rulesRes.json();
          const groups: any[] = data.groups || [];
          const flat: Rule[] = [];
          groups.forEach((g: any) => {
            (g.rules || []).forEach((r: any) => {
              flat.push({
                name: r.name,
                query: r.query || r.expr || '',
                state: r.state || 'inactive',
                group: g.name,
                lastEvaluation: r.lastEvaluation || '',
              });
            });
          });
          setRules(flat);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  const envHosts = activeEnv?.hostnames ?? null;
  const active = alerts.filter(a =>
    ['firing', 'pending'].includes(a.state) &&
    !silenced.has(a.id) &&
    (!envHosts || envHosts.includes(a.host))
  );
  const sorted = [...active].sort((a, b) => {
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9);
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <div className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center px-8 shrink-0 gap-3">
        <span className="text-sm text-zinc-400">Alerts</span>
        {activeEnv && (
          <span className="text-xs text-zinc-600">
            / <span className="text-zinc-400">{activeEnv.name}</span>
          </span>
        )}
        {active.length > 0 && (
          <span className="ml-1 bg-red-500/20 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full">
            {active.length} active
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

        {/* Active Alerts */}
        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-4">Active Alerts</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-indigo-500" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-200">No active alerts — all systems within thresholds.</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Alert</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Severity</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Host</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Firing For</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {sorted.map(alert => (
                    <tr key={alert.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-100">{alert.summary}</p>
                        {alert.description && (
                          <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">{alert.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {alert.severity === 'critical'
                          ? <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> CRITICAL</span>
                          : <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> WARNING</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-zinc-300 font-mono text-xs">{alert.host}{alert.vmid ? ` #${alert.vmid}` : ''}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs tabular-nums">{formatDuration(alert.activeAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setModalContext({
                                name: alert.name,
                                severity: alert.severity,
                                summary: alert.summary,
                                description: alert.description,
                                host: alert.host,
                                vmid: alert.vmid,
                                labels: alert.labels,
                                annotations: alert.annotations,
                              });
                              setModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 text-xs font-semibold border border-indigo-500/20 transition-colors shrink-0"
                            title="Ask the Looking Glass for troubleshooting guidance"
                          >
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                            Ask
                          </button>
                          <SilenceDropdown alert={alert} onSilenced={id => setSilenced(s => new Set([...s, id]))} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Alert Rules */}
        <section>
          <h2 className="text-base font-semibold text-zinc-100 mb-4">Alert Rules</h2>
          {rules.length === 0 ? (
            <p className="text-sm text-zinc-600 italic">No rules loaded yet.</p>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Rule</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Group</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Expression</th>
                    <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rules.map((rule, i) => (
                    <tr key={i} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-100">{rule.name}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{rule.group}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500 hidden lg:table-cell max-w-xs">
                        <span className="truncate block">{rule.query}</span>
                      </td>
                      <td className="px-4 py-3"><StateBadge state={rule.state} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <AskLookingGlassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        contextType="alert"
        payload={modalContext}
      />
    </div>
  );
}
