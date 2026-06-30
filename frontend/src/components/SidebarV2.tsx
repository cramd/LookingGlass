'use client';

import React, { useEffect, useState } from 'react';
import { LayoutDashboard, FileText, Bell, Layers, ChevronDown } from 'lucide-react';
import type { ActivePage } from '@/app/page';
import { useEnv } from '@/app/page';
import { Environment, ENV_COLOR_CLASSES, loadEnvironments } from '@/lib/environments';
import UpsellHook from './UpsellHook';
import PlatformLinks from './PlatformLinks';

interface SidebarV2Props {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}

export default function SidebarV2({ activePage, onNavigate }: SidebarV2Props) {
  const { activeEnv, setActiveEnv } = useEnv();
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [envOpen, setEnvOpen] = useState(false);

  useEffect(() => {
    setEnvs(loadEnvironments());
  }, []);

  useEffect(() => {
    setEnvs(loadEnvironments());
  }, [activePage]);

  const link = (page: ActivePage, icon: React.ReactNode, label: string, badge?: React.ReactNode) => {
    const active = activePage === page;
    return (
      <button
        onClick={() => onNavigate(page)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left ${
          active
            ? 'bg-[#5b58f0] text-white font-medium shadow-md shadow-[#5b58f0]/20'
            : 'text-[#8f8f9d] hover:text-white hover:bg-[#20202d]'
        }`}
      >
        {icon}
        <span className="flex-1">{label}</span>
        {badge && <div>{badge}</div>}
      </button>
    );
  };

  const dotColor = activeEnv ? (ENV_COLOR_CLASSES[activeEnv.color] ?? ENV_COLOR_CLASSES['indigo']!).dot : null;

  return (
    <aside className="w-64 bg-[#14141f] border-r border-[#2a2a3b] flex flex-col h-full shrink-0 overflow-hidden">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6">
        <div className="w-8 h-8 rounded-lg mr-3 shadow-lg flex items-center justify-center bg-gradient-to-br from-[#5b58f0] to-[#7d7aff]">
          <span className="text-white font-bold text-lg">L</span>
        </div>
        <span className="text-lg font-bold text-white tracking-tight">Looking Glass</span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-6 px-4 py-4 scrollbar-hide">
        {/* Main Navigation */}
        <nav className="space-y-1">
          {link('dashboard',    <LayoutDashboard className="w-5 h-5" />, 'Cluster Overview')}
          {link('logs',         <FileText className="w-5 h-5" />,        'Guest Workloads', <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#34344a] text-white text-[10px] font-bold">3</span>)}
          {link('environments', <Layers className="w-5 h-5" />,          'Syslog Stream', <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>)}
          {link('alerts',       <Bell className="w-5 h-5" />,            'Active Alerts', <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#ef4444] text-white text-[10px] font-bold">1</span>)}
        </nav>

        {/* Selected Environment Section */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#5c5c70] px-2">Selected Environment</span>
          <div className="relative">
            <button
              onClick={() => setEnvOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a24] hover:bg-[#20202d] border border-[#2a2a3b] transition-colors text-left"
            >
              {dotColor
                ? <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                : <span className="w-2 h-2 rounded-full shrink-0 bg-zinc-600" />}
              <span className="flex-1 text-sm text-zinc-300 truncate">
                {activeEnv ? activeEnv.name : 'All Clusters'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            </button>

            {envOpen && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-[#1a1a24] border border-[#2a2a3b] rounded-lg shadow-xl overflow-hidden z-50">
                <button
                  onClick={() => { setActiveEnv(null); setEnvOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#20202d] transition-colors ${!activeEnv ? 'text-[#5b58f0]' : 'text-zinc-400'}`}
                >
                  <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                  All Clusters
                </button>
                {envs.map(env => {
                  const c = ENV_COLOR_CLASSES[env.color] ?? ENV_COLOR_CLASSES['indigo']!;
                  const isActive = activeEnv?.id === env.id;
                  return (
                    <button
                      key={env.id}
                      onClick={() => { setActiveEnv(env); setEnvOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#20202d] transition-colors ${isActive ? c.text : 'text-zinc-400'}`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                      {env.name}
                      {env.hostnames.length > 0 && (
                        <span className="ml-auto text-xs text-zinc-600">{env.hostnames.length} nodes</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Series Utilization Section */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#5c5c70] px-2">Series Utilization</span>
          <div className="v2-widget-override">
            <UpsellHook />
          </div>
        </div>

        {/* Deep Links Section */}
        <div className="flex flex-col gap-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#5c5c70] px-2">Deep Links</span>
          <div className="v2-widget-override">
            <PlatformLinks />
          </div>
        </div>
      </div>
    </aside>
  );
}
