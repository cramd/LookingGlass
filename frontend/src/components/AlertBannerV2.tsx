'use client';

import { getApiUrl } from '@/lib/config';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import AskLookingGlassModal from './AskLookingGlassModal';

interface FiringAlert {
  id: string;
  name: string;
  state: string;
  severity: string;
  summary: string;
  description: string;
  host: string;
  vmid?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export default function AlertBannerV2() {
  const [alerts, setAlerts] = useState<FiringAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

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
          host: a.labels?.host || a.labels?.nodename || '—',
          vmid: a.labels?.vmid,
          labels: a.labels || {},
          annotations: a.annotations || {},
        })));
      } catch {
        // silently skip if API is not reachable
      }
    }

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, []);

  const visible = alerts.filter(a => a.state === 'firing' && a.severity === 'critical' && !dismissed.has(a.id));
  const activeAlert = visible.length > 0 ? visible[0] : null;

  if (!activeAlert) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#7f1d1d] text-white border-t border-[#991b1b] shadow-2xl flex items-center justify-between px-6 py-3 animate-in slide-in-from-bottom-full duration-500">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-300" />
          <span className="font-semibold text-sm">Alert: {activeAlert.summary}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setModalOpen(true)}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border border-white/20"
          >
            Inspect Runbook
          </button>
          <button
            onClick={() => setDismissed(d => new Set([...d, activeAlert.id]))}
            className="text-white/70 hover:text-white p-1 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <AskLookingGlassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        contextType="alert"
        payload={activeAlert}
      />
    </>
  );
}
