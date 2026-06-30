'use client';

import { getApiUrl } from '@/lib/config';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, XCircle, X, ChevronDown, ChevronRight } from 'lucide-react';

interface FiringAlert {
  id: string;
  name: string;
  state: string;
  severity: string;
  summary: string;
  description: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

const COLLAPSED_STORAGE_KEY = 'alertBanner.collapsed';

function readCollapsedPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = sessionStorage.getItem(COLLAPSED_STORAGE_KEY);
  return stored === null ? true : stored === 'true';
}

export default function AlertBanner() {
  const [alerts, setAlerts] = useState<FiringAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    const apiUrl = getApiUrl();

    async function fetchAlerts() {
      try {
        const res = await fetch(`${apiUrl}/api/v1/alerts`);
        if (!res.ok) return;
        const data = await res.json();
        const raw: any[] = data.alerts || [];
        setAlerts(raw.map((a: any) => ({
          id: `${a.name}-${a.labels?.host || ''}-${a.labels?.vmid || ''}`,
          name: a.name,
          state: a.state,
          severity: a.labels?.severity || 'warning',
          summary: a.annotations?.summary || a.name,
          description: a.annotations?.description || '',
          labels: a.labels || {},
          annotations: a.annotations || {},
        })));
      } catch {
        // vmalert not yet reachable — silently skip
      }
    }

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, []);

  const visible = alerts.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const criticalCount = visible.filter(a => a.severity === 'critical').length;
  const warningCount  = visible.filter(a => a.severity === 'warning').length;
  const hasCritical   = criticalCount > 0;

  const totalPages = Math.ceil(visible.length / perPage);
  const safePage   = Math.min(page, totalPages - 1);
  const pageItems  = visible.slice(safePage * perPage, safePage * perPage + perPage);

  return (
    <div className="px-8 pt-4">
      <div className={`rounded-xl border overflow-hidden ${hasCritical ? 'border-red-500/20' : 'border-amber-500/20'}`}>
        {/* Collapsible header */}
        <button
          onClick={() => setCollapsed(c => {
            const next = !c;
            sessionStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
            return next;
          })}
          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
            hasCritical
              ? 'bg-red-500/10 hover:bg-red-500/15'
              : 'bg-amber-500/10 hover:bg-amber-500/15'
          }`}
        >
          <div className="flex items-center gap-3">
            {hasCritical
              ? <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            }
            <span className={`text-sm font-semibold ${hasCritical ? 'text-red-200' : 'text-amber-200'}`}>
              Active Alerts
            </span>
            {/* Severity pill counts */}
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3" /> Critical {criticalCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> Warning {warningCount}
                </span>
              )}
            </div>
          </div>
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
            : <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
          }
        </button>

        {/* Alert rows */}
        {!collapsed && (
          <div className="divide-y divide-zinc-800/50">
            {pageItems.map(alert => {
              const isCritical = alert.severity === 'critical';
              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 px-4 py-3 ${
                    isCritical ? 'bg-red-500/5 text-red-200' : 'bg-amber-500/5 text-amber-200'
                  }`}
                >
                  {isCritical
                    ? <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>
                        {alert.severity}
                      </span>
                      <span className="text-sm font-medium">{alert.summary}</span>
                    </div>
                    {alert.description && (
                      <p className="text-xs mt-0.5 opacity-70">{alert.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setDismissed(d => new Set([...d, alert.id]))}
                    className={`shrink-0 p-1 transition-opacity hover:opacity-60 ${isCritical ? 'text-red-400' : 'text-amber-400'}`}
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            {/* Pagination footer */}
            {(totalPages > 1 || true) && (
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/60 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <span>Per page:</span>
                  <select
                    value={perPage}
                    onChange={e => { setPerPage(Number(e.target.value)); setPage(0); }}
                    className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {[5, 10, 25, 50].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <span>{safePage * perPage + 1}–{Math.min(safePage * perPage + perPage, visible.length)} of {visible.length}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ‹
                    </button>
                    <span className="px-1">{safePage + 1} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
