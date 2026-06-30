'use client';

import React, { useEffect, useState } from 'react';
import Header from './Header';
import UpsellHook from './UpsellHook';
import PlatformLinks from './PlatformLinks';
import SmartHealthFeed from './SmartHealthFeed';
import MetricsChart from './MetricsChart';
import GuestList from './GuestList';
import AlertBanner from './AlertBanner';
import { AlertTriangle } from 'lucide-react';
import { useEnv } from '@/app/page';
import { filterHosts, filterGuests, Guest } from '@/lib/environments';

interface MetricPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  uptime: number;
}

interface DashboardMetadata {
  hosts: string[];
  currentSeriesCount: number;
  maxTierSeries: number;
  tier: string;
  range: string;
}

export default function Dashboard() {
  const { activeEnv, setAvailableHosts, setAvailableGuests } = useEnv();
  const [metrics, setMetrics] = useState<Record<string, MetricPoint[]>>({});
  const [metadata, setMetadata] = useState<DashboardMetadata | null>(null);
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

    async function fetchAll() {
      try {
        const [summaryRes, guestsRes] = await Promise.all([
          fetch(`${apiUrl}/api/v1/metrics/summary?range=1h`),
          fetch(`${apiUrl}/api/v1/metrics/guests`),
        ]);
        if (summaryRes.ok) {
          const json = await summaryRes.json();
          setMetrics(json.data || {});
          setMetadata(json.metadata || null);
          const hosts: string[] = json.metadata?.hosts || [];
          setAvailableHosts(hosts);
          if (hosts.length > 0 && !selectedHost) {
            setSelectedHost(hosts[0]);
          }
        }
        if (guestsRes.ok) {
          const json = await guestsRes.json();
          const fetchedGuests = json.guests || [];
          setGuests(fetchedGuests);
          setAvailableGuests(fetchedGuests);
        }
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [selectedHost]);

  const allHosts = metadata?.hosts || [];
  // Filter host list to the active environment (or show all)
  let hosts = filterHosts(allHosts, activeEnv);

  // If the active environment has specific guests, ensure their parent PVE host nodes
  // are included in the visible hosts list. This repairs missing/empty host configuration dynamically.
  if (activeEnv && activeEnv.guests && activeEnv.guests.length > 0) {
    const guestNodes = guests
      .filter(g => activeEnv.guests!.includes(g.id))
      .map(g => g.node);
    guestNodes.forEach(node => {
      if (allHosts.includes(node) && !hosts.includes(node)) {
        hosts.push(node);
      }
    });
  }

  const currentMetrics = selectedHost ? (metrics[selectedHost] || []) : [];
  const isOverNodeLimit = allHosts.length > 2 && metadata?.tier === 'free';

  // If the selected host is no longer in the filtered set, auto-select first visible host
  const effectiveHost = hosts.includes(selectedHost) ? selectedHost : (hosts[0] ?? '');

  const filteredGuests = filterGuests(guests, activeEnv);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0a0a]">
      <Header tier={metadata?.tier} />
      
      <AlertBanner />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {/* Node Limit Upsell Hook */}
          {isOverNodeLimit && (
            <div className="mb-6 flex items-start gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-indigo-200">
              <AlertTriangle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-indigo-400">Cluster Visibility Restricted</h4>
                <p className="text-sm mt-1 opacity-90">
                  Free accounts are limited to 2 monitored nodes. You have {hosts.length} nodes connected. <strong>Upgrade your Looking Glass tier to unlock full cluster visibility.</strong>
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Cluster Overview</h1>
              {activeEnv && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  Filtered by <span className="text-zinc-300 font-medium">{activeEnv.name}</span>
                </p>
              )}
            </div>
            <div className="flex gap-4">
              {hosts.length > 0 && (
                <select
                  value={effectiveHost}
                  onChange={(e) => setSelectedHost(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {hosts.map(host => (
                    <option key={host} value={host}>{host}</option>
                  ))}
                </select>
              )}
              
              <select className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="1h">Last 1 Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
              </select>
            </div>
          </div>

          {loading && Object.keys(metrics).length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content Area (Chart + Health + Guests) */}
              <div className="lg:col-span-2 space-y-6">
                <SmartHealthFeed metrics={currentMetrics} />
                <MetricsChart data={currentMetrics} />
                <GuestList guests={filteredGuests} selectedNode={effectiveHost} />
              </div>

              {/* Sidebar Widgets */}
              <div className="space-y-6">
                <UpsellHook />

                {/* Node stats */}
                {selectedHost && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-zinc-100 mb-4">{selectedHost} Stats</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-zinc-500">Average CPU</p>
                        <p className="text-lg font-medium text-zinc-200">
                          {currentMetrics.length ? (currentMetrics.reduce((acc, m) => acc + m.cpu, 0) / currentMetrics.length).toFixed(1) : 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Average Memory</p>
                        <p className="text-lg font-medium text-zinc-200">
                          {currentMetrics.length ? (currentMetrics.reduce((acc, m) => acc + m.memory, 0) / currentMetrics.length).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <PlatformLinks selectedHost={effectiveHost} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
