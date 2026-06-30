'use client';

import React, { useState, useEffect } from 'react';
import { Server, Box, ChevronDown, ChevronRight, HardDrive, Wifi, ExternalLink, ArrowUpDown, ArrowDown, ArrowUp, Sparkles } from 'lucide-react';
import AskLookingGlassModal from './AskLookingGlassModal';

interface Guest {
  id: string;
  name: string;
  type: 'qemu' | 'lxc';
  node: string;
  cpu: number;
  memory: number;
  running: boolean;
}

interface GuestDetail {
  diskReadBytesPerSec: number;
  diskWriteBytesPerSec: number;
  netInBytesPerSec: number;
  netOutBytesPerSec: number;
  uptime: number;
}

interface LogLine {
  _time?: string;
  _msg?: string;
  message?: string;
  [key: string]: unknown;
}

interface GuestListProps {
  guests: Guest[];
  selectedNode: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B/s`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / 1_048_576).toFixed(1)} MB/s`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function UsageBar({ value, warn = 75, danger = 90 }: { value: number; warn?: number; danger?: number }) {
  const color = value >= danger ? 'bg-red-500' : value >= warn ? 'bg-amber-500' : 'bg-indigo-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${value >= danger ? 'text-red-400' : value >= warn ? 'text-amber-400' : 'text-zinc-300'}`}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function buildVlUrl(node: string, timestamp: string): string {
  const vlBase = process.env.NEXT_PUBLIC_VICTORIALOGS_URL || 'http://192.168.0.100:9428';
  const ts = new Date(timestamp).getTime();
  const from = ts - 5 * 60 * 1000;
  const to   = ts + 5 * 60 * 1000;
  const query = `{tags.host="${node}"}`;
  return `${vlBase}/select/vmui/#/?query=${encodeURIComponent(query)}&from=${from}&to=${to}`;
}

function GuestDetailPanel({ guest }: { guest: Guest }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
  const [detail, setDetail] = useState<GuestDetail | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/api/v1/metrics/guest/${guest.type}/${guest.id}`)
      .then(r => r.json())
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));

    // Logs are tagged by PVE node (tags.host), not by individual guest vmid.
    // Filtering _msg by vmid falsely matches IPs like 192.168.0.100 and misses most guests.
    const now   = Date.now();
    const start = now - 24 * 60 * 60 * 1000;
    const params = new URLSearchParams({
      nodename: guest.node,
      limit: '30',
      start: String(start),
      end: String(now),
    });
    fetch(`${apiUrl}/api/v1/logs?${params}`)
      .then(r => r.json())
      .then(d => setLogs(d.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoadingLogs(false));
  }, [guest.id, guest.type, guest.node, apiUrl]);

  return (
    <div className="mt-2 mx-1 rounded-lg bg-zinc-950 border border-zinc-700/50 p-4 space-y-4">
      {/* Resource Header with Ask button */}
      <div className="flex items-center justify-between border-b border-zinc-800/40 pb-2">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Resource Statistics</span>
        <button
          onClick={() => setModalOpen(true)}
          disabled={loadingDetail || !detail}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 text-[10px] font-semibold border border-indigo-500/20 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
          title="Ask the Looking Glass to analyze resource usage"
        >
          <Sparkles className="w-3 h-3 animate-pulse" />
          Ask Looking Glass
        </button>
      </div>

      {/* Disk + Network stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loadingDetail ? (
          <div className="col-span-4 flex justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-indigo-500" />
          </div>
        ) : detail ? (
          <>
            <div className="bg-zinc-900 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <HardDrive className="w-3 h-3 text-zinc-500" />
                <span className="text-xs text-zinc-500">Disk Read</span>
              </div>
              <p className="text-sm font-medium text-zinc-200 tabular-nums">{formatBytes(detail.diskReadBytesPerSec)}</p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <HardDrive className="w-3 h-3 text-zinc-500" />
                <span className="text-xs text-zinc-500">Disk Write</span>
              </div>
              <p className="text-sm font-medium text-zinc-200 tabular-nums">{formatBytes(detail.diskWriteBytesPerSec)}</p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Wifi className="w-3 h-3 text-zinc-500" />
                <span className="text-xs text-zinc-500">Net In</span>
              </div>
              <p className="text-sm font-medium text-zinc-200 tabular-nums">{formatBytes(detail.netInBytesPerSec)}</p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Wifi className="w-3 h-3 text-zinc-500" />
                <span className="text-xs text-zinc-500">Net Out</span>
              </div>
              <p className="text-sm font-medium text-zinc-200 tabular-nums">{formatBytes(detail.netOutBytesPerSec)}</p>
            </div>
            {detail.uptime > 0 && (
              <div className="col-span-2 sm:col-span-4 text-xs text-zinc-500">
                Uptime: <span className="text-zinc-400">{formatUptime(detail.uptime)}</span>
              </div>
            )}
          </>
        ) : (
          <p className="col-span-4 text-xs text-zinc-600">Disk/network stats unavailable</p>
        )}
      </div>

      {/* Log panel */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
          Recent Node Logs
          <span className="ml-1 normal-case text-zinc-600">({guest.node})</span>
        </p>
        {loadingLogs ? (
          <div className="flex justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-indigo-500" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-xs text-zinc-600 italic">
            No recent logs for {guest.node}.
          </p>
        ) : (
          <div className="h-40 overflow-y-auto rounded bg-black/40 p-2 font-mono text-xs space-y-0.5">
            {logs.map((line, i) => {
              const ts   = line._time ? new Date(line._time as string).toLocaleTimeString() : null;
              const msg  = (line._msg || line.message || JSON.stringify(line)) as string;
              const vlUrl = line._time ? buildVlUrl(guest.node, line._time as string) : null;
              return (
                <div key={i} className="group flex items-start gap-1 text-zinc-400 leading-relaxed hover:text-zinc-200 transition-colors">
                  {ts && <span className="text-zinc-600 mr-1 shrink-0">{ts}</span>}
                  <span className="flex-1 break-all">{msg}</span>
                  {vlUrl && (
                    <a
                      href={vlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 shrink-0 ml-1 transition-opacity"
                      title="Open in VictoriaLogs"
                    >
                      <ExternalLink className="w-3 h-3 text-indigo-400 hover:text-indigo-300" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AskLookingGlassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        contextType="guest"
        payload={{
          id: guest.id,
          name: guest.name,
          type: guest.type,
          node: guest.node,
          cpuUsagePercent: guest.cpu,
          memoryUsagePercent: guest.memory,
          running: guest.running,
          diskReadBytesPerSec: detail?.diskReadBytesPerSec,
          diskWriteBytesPerSec: detail?.diskWriteBytesPerSec,
          netInBytesPerSec: detail?.netInBytesPerSec,
          netOutBytesPerSec: detail?.netOutBytesPerSec,
          uptimeSeconds: detail?.uptime,
        }}
      />
    </div>
  );
}

function GuestRow({ guest }: { guest: Guest }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = guest.type === 'qemu' ? Server : Box;

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          }
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${guest.running ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
          <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="text-sm text-zinc-200 truncate">{guest.name}</span>
          <span className="text-xs text-zinc-600 shrink-0">#{guest.id}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-3">
          <div className="hidden sm:block">
            <p className="text-xs text-zinc-600 mb-0.5">CPU</p>
            <UsageBar value={guest.cpu} />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs text-zinc-600 mb-0.5">MEM</p>
            <UsageBar value={guest.memory} />
          </div>
          <div className="sm:hidden text-xs text-zinc-400">
            {guest.cpu.toFixed(0)}% / {guest.memory.toFixed(0)}%
          </div>
        </div>
      </button>
      {expanded && <GuestDetailPanel guest={guest} />}
    </div>
  );
}

type SortField = 'name' | 'cpu' | 'memory' | null;
type SortDir   = 'asc' | 'desc';

function SortButton({
  label, field, active, dir, onClick,
}: {
  label: string; field: SortField; active: boolean; dir: SortDir; onClick: () => void;
}) {
  const Icon = active ? (dir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
        active
          ? 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      {label}
      <Icon className="w-3 h-3" />
    </button>
  );
}

export default function GuestList({ guests, selectedNode }: GuestListProps) {
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir]     = useState<SortDir>('desc');

  const filtered = selectedNode ? guests.filter(g => g.node === selectedNode) : guests;

  if (filtered.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">VMs &amp; Containers</h3>
        <p className="text-sm text-zinc-500">
          {selectedNode ? `No guests found on ${selectedNode}.` : 'No guests found.'}
        </p>
      </div>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortField(null); setSortDir('desc'); }
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortGuests = (items: Guest[]) => {
    if (!sortField) return items;
    return [...items].sort((a, b) => {
      const av = sortField === 'name' ? a.name.toLowerCase() : a[sortField];
      const bv = sortField === 'name' ? b.name.toLowerCase() : b[sortField];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  };

  const vms  = filtered.filter(g => g.type === 'qemu');
  const lxcs = filtered.filter(g => g.type === 'lxc');

  const Section = ({ title, items, icon: Icon }: { title: string; items: Guest[]; icon: React.ElementType }) =>
    items.length > 0 ? (
      <div className="mb-4 last:mb-0">
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</span>
          <span className="text-xs text-zinc-600">({items.length})</span>
        </div>
        <div className="space-y-1">
          {sortGuests(items).map(g => <GuestRow key={`${g.type}-${g.id}`} guest={g} />)}
        </div>
      </div>
    ) : null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">
          VMs &amp; Containers
          {selectedNode && <span className="ml-2 text-xs font-normal text-zinc-500">on {selectedNode}</span>}
        </h3>
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-600 mr-1">Sort:</span>
          <SortButton label="Name" field="name"   active={sortField === 'name'}   dir={sortDir} onClick={() => handleSort('name')} />
          <SortButton label="CPU"  field="cpu"    active={sortField === 'cpu'}    dir={sortDir} onClick={() => handleSort('cpu')} />
          <SortButton label="MEM"  field="memory" active={sortField === 'memory'} dir={sortDir} onClick={() => handleSort('memory')} />
        </div>
      </div>
      <Section title="Virtual Machines" items={vms}  icon={Server} />
      <Section title="Containers"        items={lxcs} icon={Box} />
    </div>
  );
}
