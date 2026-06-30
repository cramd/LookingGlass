'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import LogsPage from '@/components/LogsPage';
import AlertsPage from '@/components/AlertsPage';
import EnvironmentsPage from '@/components/EnvironmentsPage';
import { Environment, loadEnvironments } from '@/lib/environments';

// V2 Components
import TopBarV2 from '@/components/TopBarV2';
import SidebarV2 from '@/components/SidebarV2';
import DashboardV2 from '@/components/DashboardV2';
import AlertBannerV2 from '@/components/AlertBannerV2';
import { Sparkles } from 'lucide-react';

export type ActivePage = 'dashboard' | 'logs' | 'alerts' | 'environments';

// ─── Global environment context ──────────────────────────────────────────────
interface EnvContextValue {
  activeEnv: Environment | null;
  setActiveEnv: (env: Environment | null) => void;
  availableHosts: string[];
  setAvailableHosts: (hosts: string[]) => void;
  availableGuests: any[];
  setAvailableGuests: (guests: any[]) => void;
}

export const EnvContext = createContext<EnvContextValue>({
  activeEnv: null,
  setActiveEnv: () => {},
  availableHosts: [],
  setAvailableHosts: () => {},
  availableGuests: [],
  setAvailableGuests: () => {},
});

export function useEnv() { return useContext(EnvContext); }

// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [activeEnv, setActiveEnvState] = useState<Environment | null>(null);
  const [availableHosts, setAvailableHosts] = useState<string[]>([]);
  const [availableGuests, setAvailableGuests] = useState<any[]>([]);
  const [useExperimentalUI, setUseExperimentalUI] = useState(false);

  // Restore persisted env selection from localStorage
  useEffect(() => {
    const envs = loadEnvironments();
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('lookingglass.activeEnvId') : null;
    if (savedId && envs.length) {
      const found = envs.find(e => e.id === savedId) ?? null;
      setActiveEnvState(found);
    }
    
    // Load UI preference
    const pref = typeof window !== 'undefined' ? localStorage.getItem('lookingglass.experimentalUI') : null;
    if (pref === 'true') {
      setUseExperimentalUI(true);
    }
  }, []);

  const setActiveEnv = (env: Environment | null) => {
    setActiveEnvState(env);
    if (typeof window !== 'undefined') {
      if (env) localStorage.setItem('lookingglass.activeEnvId', env.id);
      else localStorage.removeItem('lookingglass.activeEnvId');
    }
  };

  const toggleUI = () => {
    const next = !useExperimentalUI;
    setUseExperimentalUI(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lookingglass.experimentalUI', String(next));
    }
  };

  return (
    <EnvContext.Provider value={{ activeEnv, setActiveEnv, availableHosts, setAvailableHosts, availableGuests, setAvailableGuests }}>
      
      {useExperimentalUI ? (
        // Experimental V2 UI Layout
        <div className="flex flex-col h-screen w-full bg-[#0b0b12] overflow-hidden text-zinc-50 font-sans">
          <TopBarV2 onToggleUI={toggleUI} />
          <div className="flex-1 flex flex-row overflow-hidden relative">
            <SidebarV2 activePage={activePage} onNavigate={setActivePage} />
            
            {/* Main Content Area */}
            {activePage === 'dashboard'    && <DashboardV2 />}
            {activePage === 'logs'         && <LogsPage />}
            {activePage === 'alerts'       && <AlertsPage />}
            {activePage === 'environments' && <EnvironmentsPage availableHosts={availableHosts} />}
            
            <AlertBannerV2 />
          </div>
        </div>
      ) : (
        // Stable V1 UI Layout
        <div className="flex h-screen w-full bg-zinc-950 overflow-hidden text-zinc-50 relative">
          <Sidebar activePage={activePage} onNavigate={setActivePage} />
          {activePage === 'dashboard'    && <Dashboard />}
          {activePage === 'logs'         && <LogsPage />}
          {activePage === 'alerts'       && <AlertsPage />}
          {activePage === 'environments' && <EnvironmentsPage availableHosts={availableHosts} />}
          
          {/* Floating UI Toggle Button for Stable Mode */}
          <button
            onClick={toggleUI}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full shadow-lg shadow-indigo-500/30 transition-all font-medium text-sm border border-indigo-400/30"
          >
            <Sparkles className="w-4 h-4" />
            Try New UI
          </button>
        </div>
      )}
      
    </EnvContext.Provider>
  );
}
