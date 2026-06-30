import React from 'react';
import { User, Zap } from 'lucide-react';

interface HeaderProps {
  tier?: string;
}

export default function Header({ tier = 'free' }: HeaderProps) {
  const isFree = tier.toLowerCase() === 'free';

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-8 shrink-0">
      <div className="flex items-center text-zinc-400">
        <span className="text-sm">Dashboard Overview</span>
      </div>
      
      <div className="flex items-center gap-6">
        {isFree && (
          <button className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40">
            <Zap className="w-4 h-4" />
            Upgrade to Pro
          </button>
        )}
        
        <div className="flex items-center gap-3 pl-6 border-l border-zinc-800 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-zinc-100">Jane Doe</div>
            <div className="text-xs text-zinc-500">jane@example.com</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
            <User className="w-5 h-5 text-zinc-400" />
          </div>
        </div>
      </div>
    </header>
  );
}
