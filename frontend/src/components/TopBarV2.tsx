'use client';

import React from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { useEnv } from '@/app/page';

interface TopBarV2Props {
  onToggleUI: () => void;
}

export default function TopBarV2({ onToggleUI }: TopBarV2Props) {
  const { activeEnv } = useEnv();

  return (
    <div className="h-12 bg-[#12121a] border-b border-[#2a2a3b] flex items-center justify-between px-4 shrink-0 text-sm">
      {/* Left side: Window dots and Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
          <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
        </div>
        <span className="text-zinc-300 font-semibold tracking-wide ml-2">Looking Glass Console v1.2.0</span>
      </div>

      {/* Right side: Config Profile, Toggle, Status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Configuration Profile:</span>
          <button className="flex items-center gap-1 hover:text-zinc-200 transition-colors">
            <span>{activeEnv ? activeEnv.name : 'Standard Profile (2 Nodes)'}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* UI Toggle */}
        <button
          onClick={onToggleUI}
          className="px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-full border border-indigo-500/20 transition-colors shadow-sm"
        >
          Revert to Stable UI
        </button>

        <div className="flex items-center gap-1.5 bg-[#1a2e20] text-[#4ade80] px-3 py-1 rounded-full border border-[#14532d] shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">ShiftMon Connected</span>
        </div>
      </div>
    </div>
  );
}
