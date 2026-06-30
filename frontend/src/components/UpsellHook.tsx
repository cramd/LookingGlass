'use client';

import { getApiUrl } from '@/lib/config';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, BarChart2, HardDrive, RefreshCw } from 'lucide-react';

interface UsageData {
  tier: string;
  currentSeriesCount: number;
  maxTierSeries: number | null;
  retentionDays: number;
  seriesWarnThreshold: number;
  metricsStorageBytes: number;
  metricsFreeDiskBytes: number | null;
  logsStorageBytes: number;
  logsFreeDiskBytes: number | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

function DiskBar({ usedBytes, freeBytes, label }: { usedBytes: number; freeBytes: number | null; label: string }) {
  if (freeBytes === null) return null;
  const total = usedBytes + freeBytes;
  const pct = total > 0 ? (usedBytes / total) * 100 : 0;
  const isDanger = pct > 80;
  const isWarn = pct > 60;
  const color = isDanger ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-indigo-500';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-500 flex items-center gap-1">
          <HardDrive className="w-3 h-3" />
          {label}
        </span>
        <span className={isDanger ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-zinc-400'}>
          {formatBytes(usedBytes)} / {formatBytes(total)}
        </span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export default function UpsellHook() {
  const apiUrl = getApiUrl();
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://192.168.0.100:3001';
  const vmDirectUrl = process.env.NEXT_PUBLIC_VM_DIRECT_URL || 'http://192.168.0.100:8428';
  const vlUrl = process.env.NEXT_PUBLIC_VICTORIALOGS_URL || 'http://192.168.0.100:9428';

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchUsage = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/usage`);
      if (res.ok) {
        setUsage(await res.json());
        setLastUpdated(new Date());
      }
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    const id = setInterval(fetchUsage, 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-1/2 mb-3" />
        <div className="h-2 bg-zinc-800 rounded w-full mb-2" />
        <div className="h-2 bg-zinc-800 rounded w-3/4" />
      </div>
    );
  }

  if (!usage) return null;

  const { currentSeriesCount, maxTierSeries, seriesWarnThreshold, retentionDays,
          metricsStorageBytes, metricsFreeDiskBytes, logsStorageBytes, logsFreeDiskBytes } = usage;

  const seriesPct = maxTierSeries && maxTierSeries > 0
    ? (currentSeriesCount / maxTierSeries) * 100
    : 0;
  const isSeriesWarn = maxTierSeries !== null && (currentSeriesCount / maxTierSeries) >= seriesWarnThreshold;
  const seriesBarColor = isSeriesWarn ? 'bg-amber-500' : 'bg-indigo-500';

  return (
    <div className="flex flex-col gap-3">
      {/* Active Time Series */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-indigo-400" />
              Active Time Series
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">Live from VictoriaMetrics</p>
          </div>
          <div className="text-right">
            <span className={`text-xl font-bold tabular-nums ${isSeriesWarn ? 'text-amber-400' : 'text-zinc-100'}`}>
              {currentSeriesCount.toLocaleString()}
            </span>
            {maxTierSeries !== null && (
              <span className="text-sm text-zinc-500"> / {maxTierSeries.toLocaleString()}</span>
            )}
          </div>
        </div>

        {maxTierSeries !== null && (
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-700 ${seriesBarColor}`}
              style={{ width: `${Math.min(seriesPct, 100)}%` }}
            />
          </div>
        )}

        {/* Disk usage rows */}
        <div className="space-y-2 mt-3">
          <DiskBar usedBytes={metricsStorageBytes} freeBytes={metricsFreeDiskBytes} label="Metrics storage" />
          <DiskBar usedBytes={logsStorageBytes} freeBytes={logsFreeDiskBytes} label="Logs storage" />
        </div>

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800">
          <span className="text-xs text-zinc-600">
            {retentionDays}d retention · {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
          </span>
          <button
            onClick={fetchUsage}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Warning banner when approaching series limit */}
      {isSeriesWarn && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Storage Limit Approaching</p>
              <p className="text-xs text-amber-300/70 mt-0.5">
                {Math.round(seriesPct)}% of {maxTierSeries?.toLocaleString()} series used. Upgrade for unlimited series and extended retention.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <a
              href={`${vmDirectUrl}/vmui/#/cardinality`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Explore cardinality
            </a>
            <a
              href={grafanaUrl}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open Grafana
            </a>
            <a
              href={`${vlUrl}/select/vmui`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> View logs usage
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
