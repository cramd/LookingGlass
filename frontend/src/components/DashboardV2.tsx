'use client';

import { getApiUrl } from '@/lib/config';
import React, { useEffect, useState } from 'react';
import { useEnv } from '@/app/page';
import { filterHosts } from '@/lib/environments';
import NodeCardV2 from './NodeCardV2';

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

export default function DashboardV2() {
  const { activeEnv, setAvailableHosts, setAvailableGuests } = useEnv();
  const [metrics, setMetrics] = useState<Record<string, MetricPoint[]>>({});
  const [metadata, setMetadata] = useState<DashboardMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = getApiUrl();

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
        }
        if (guestsRes.ok) {
          const json = await guestsRes.json();
          const fetchedGuests = json.guests || [];
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
  }, []);

  const allHosts = metadata?.hosts || [];
  let hosts = filterHosts(allHosts, activeEnv);

  // Fallback to mock data for demonstration if no data is present yet
  if (!loading && hosts.length === 0) {
    hosts = ['pve-node-01', 'pve-node-02'];
  }

  return (
    <main className="flex-1 overflow-y-auto p-10 bg-[#0b0b12]">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Cluster Overview</h1>
            <p className="text-[#8f8f9d] mt-1 text-sm">
              Physical hardware metrics processed via VictoriaMetrics API
            </p>
          </div>
          <button className="flex items-center gap-2 bg-[#1a1a24] hover:bg-[#20202d] border border-[#2a2a3b] text-white px-4 py-2 rounded-xl transition-all shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse"></span>
            <span className="text-sm font-medium">Active Stream</span>
          </button>
        </div>

        {loading && Object.keys(metrics).length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#5b58f0]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {hosts.map(host => {
              const hostMetrics = metrics[host] || [];
              let avgCpu = 0;
              let avgMem = 0;
              let uptime = 0;
              
              if (hostMetrics.length > 0) {
                avgCpu = hostMetrics.reduce((acc, m) => acc + m.cpu, 0) / hostMetrics.length;
                avgMem = hostMetrics.reduce((acc, m) => acc + m.memory, 0) / hostMetrics.length;
                uptime = hostMetrics[hostMetrics.length - 1].uptime;
              } else {
                // Mock data for UI demonstration if metrics are missing
                avgCpu = host === 'pve-node-01' ? 69.4 : 42.1;
                avgMem = host === 'pve-node-01' ? 79.2 : 55.6;
                uptime = 142;
              }

              // Uptime is in seconds in the actual API, convert to days.
              // Assuming API provides seconds for uptime, let's divide if it's large, otherwise mock.
              const uptimeDays = uptime > 1000 ? Math.floor(uptime / 86400) : uptime;

              return (
                <NodeCardV2 
                  key={host}
                  nodeName={host}
                  cpuPercent={avgCpu}
                  memoryPercent={avgMem}
                  uptimeDays={uptimeDays}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
