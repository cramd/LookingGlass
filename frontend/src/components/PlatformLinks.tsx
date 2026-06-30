'use client';

import React from 'react';
import { ExternalLink, LayoutDashboard, Activity, Bell, Search, FileSearch } from 'lucide-react';

interface PlatformLinksProps {
  selectedHost?: string;
}

interface PlatformLink {
  label: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}

export default function PlatformLinks({ selectedHost }: PlatformLinksProps) {
  const grafanaUrl   = process.env.NEXT_PUBLIC_GRAFANA_URL    || 'http://192.168.0.100:3001';
  const vmDirectUrl  = process.env.NEXT_PUBLIC_VM_DIRECT_URL  || 'http://192.168.0.100:8428';
  const vlUrl        = process.env.NEXT_PUBLIC_VICTORIALOGS_URL || 'http://192.168.0.100:9428';

  // Build a Grafana deep link for the Proxmox dashboard
  const proxmoxDashUrl = selectedHost
    ? `${grafanaUrl}/dashboards?query=Proxmox`
    : `${grafanaUrl}/dashboards?query=Proxmox`;

  const links: PlatformLink[] = [
    {
      label: 'Proxmox Cluster',
      description: 'Full Proxmox metrics in Grafana',
      icon: <LayoutDashboard className="w-4 h-4" />,
      href: proxmoxDashUrl,
    },
    {
      label: 'VM Health & Cardinality',
      description: 'VictoriaMetrics ops dashboard',
      icon: <Activity className="w-4 h-4" />,
      href: `${grafanaUrl}/dashboards?query=VictoriaMetrics`,
    },
    {
      label: 'Alert Manager',
      description: 'Silences, routes & history',
      icon: <Bell className="w-4 h-4" />,
      href: `${grafanaUrl}/dashboards?query=Alertmanager`,
    },
    {
      label: 'Metrics Explorer',
      description: 'Raw PromQL in VMUI',
      icon: <Search className="w-4 h-4" />,
      href: `${vmDirectUrl}/vmui/`,
    },
    {
      label: 'Logs Explorer',
      description: 'Raw LogsQL in VictoriaLogs',
      icon: <FileSearch className="w-4 h-4" />,
      href: `${vlUrl}/select/vmui/`,
    },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">Platform</h3>
      <div className="space-y-1">
        {links.map(link => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
          >
            <span className="text-zinc-500 group-hover:text-indigo-400 transition-colors shrink-0">
              {link.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors leading-tight">
                {link.label}
              </p>
              <p className="text-xs text-zinc-600 truncate">{link.description}</p>
            </div>
            <ExternalLink className="w-3 h-3 text-zinc-700 group-hover:text-zinc-500 shrink-0 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
}
