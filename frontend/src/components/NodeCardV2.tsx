import React from 'react';
import { Server, Clock } from 'lucide-react';

interface NodeCardV2Props {
  nodeName: string;
  uptimeDays: number;
  cpuPercent: number;
  memoryPercent: number;
}

export default function NodeCardV2({ nodeName, uptimeDays, cpuPercent, memoryPercent }: NodeCardV2Props) {
  return (
    <div className="bg-[#14141f] border border-[#2a2a3b] rounded-2xl p-6 shadow-xl flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2a2a3b] flex items-center justify-center shadow-inner">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-white tracking-tight">{nodeName}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="px-2 py-0.5 bg-[#20202d] text-[#8f8f9d] text-[10px] font-bold uppercase tracking-wider rounded-md border border-[#2a2a3b]">
                Production
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">Uptime: {uptimeDays} days</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex flex-col gap-5">
        {/* CPU */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#8f8f9d] font-medium">CPU Usage</span>
            <span className="text-white font-bold">{cpuPercent.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 w-full bg-[#0b0b12] rounded-full overflow-hidden border border-[#2a2a3b]/50 shadow-inner">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-[#5b58f0] to-[#8b88ff]"
              style={{ width: `${Math.min(cpuPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#8f8f9d] font-medium">Memory Allocation</span>
            <span className="text-white font-bold">{memoryPercent.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 w-full bg-[#0b0b12] rounded-full overflow-hidden border border-[#2a2a3b]/50 shadow-inner">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-[#10b981] to-[#34d399]"
              style={{ width: `${Math.min(memoryPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
