'use client';

import React, { useEffect, useState } from 'react';
import { LayoutDashboard, FileText, Bell, CreditCard, Box, Layers, ChevronDown } from 'lucide-react';
import type { ActivePage } from '@/app/page';
import { useEnv } from '@/app/page';
import { Environment, ENV_COLOR_CLASSES, loadEnvironments } from '@/lib/environments';

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { activeEnv, setActiveEnv } = useEnv();
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [envOpen, setEnvOpen] = useState(false);

  useEffect(() => {
    setEnvs(loadEnvironments());
  }, []);

  // Re-read envs whenever the user returns to any page (in case they were just edited)
  useEffect(() => {
    setEnvs(loadEnvironments());
  }, [activePage]);

  const link = (page: ActivePage, icon: React.ReactNode, label: string) => {
    const active = activePage === page;
    return (
      <button
        onClick={() => onNavigate(page)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
          active
            ? 'bg-zinc-900 text-indigo-400 font-medium'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/50'
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  const dotColor = activeEnv ? (ENV_COLOR_CLASSES[activeEnv.color] ?? ENV_COLOR_CLASSES['indigo']!).dot : null;

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-zinc-800">
        <img src="/icon.png" alt="Looking Glass Logo" className="w-8 h-8 rounded-lg mr-3 shadow-[0_0_10px_rgba(99,102,241,0.2)] border border-zinc-800" />
        <span className="text-xl font-bold text-zinc-100 tracking-tight">Looking Glass</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {link('dashboard',    <LayoutDashboard className="w-5 h-5" />, 'Dashboard')}
        {link('logs',         <FileText className="w-5 h-5" />,        'App Logs')}
        {link('alerts',       <Bell className="w-5 h-5" />,            'Alerts')}
        {link('environments', <Layers className="w-5 h-5" />,          'Environments')}
      </nav>

      {/* Environment selector */}
      <div className="px-4 pb-2">
        <div className="relative">
          <button
            onClick={() => setEnvOpen(o => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors text-left"
          >
            {dotColor
              ? <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
              : <span className="w-2 h-2 rounded-full shrink-0 bg-zinc-600" />}
            <span className="flex-1 text-sm text-zinc-300 truncate">
              {activeEnv ? activeEnv.name : 'All environments'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          </button>

          {envOpen && (
            <div className="absolute bottom-full mb-1 left-0 right-0 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50">
              <button
                onClick={() => { setActiveEnv(null); setEnvOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-800 transition-colors ${!activeEnv ? 'text-indigo-400' : 'text-zinc-400'}`}
              >
                <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                All environments
              </button>
              {envs.map(env => {
                const c = ENV_COLOR_CLASSES[env.color] ?? ENV_COLOR_CLASSES['indigo']!;
                const isActive = activeEnv?.id === env.id;
                return (
                  <button
                    key={env.id}
                    onClick={() => { setActiveEnv(env); setEnvOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-800 transition-colors ${isActive ? c.text : 'text-zinc-400'}`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                    {env.name}
                    {env.hostnames.length > 0 && (
                      <span className="ml-auto text-xs text-zinc-600">{env.hostnames.length} nodes</span>
                    )}
                  </button>
                );
              })}
              {envs.length === 0 && (
                <div className="px-3 py-2 text-xs text-zinc-600 italic">No environments yet</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-zinc-800">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all shadow-[0_0_15px_rgba(99,102,241,0.1)]">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          <span className="font-medium text-indigo-100">Billing &amp; Tier</span>
        </button>
      </div>
    </aside>
  );
}
