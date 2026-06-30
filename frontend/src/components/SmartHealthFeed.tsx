import React from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';

interface SmartHealthFeedProps {
  metrics: { timestamp: string; cpu: number; memory: number }[];
}

export default function SmartHealthFeed({ metrics }: SmartHealthFeedProps) {
  // Simple heuristic for "unstable" metrics: if cpu spikes above 80% on average or highly volatile
  const isUnstable = metrics.some(m => m.cpu > 85);

  return (
    <div className="mb-6 flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      {isUnstable ? (
        <>
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">Elevated Resource Usage Detected</h4>
            <p className="text-sm text-zinc-400 mt-0.5">
              CPU utilization spiked above 85% recently. We recommend investigating the latest application logs.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">All Systems Stable</h4>
            <p className="text-sm text-zinc-400 mt-0.5">
              Resource utilization is within normal parameters over the selected time range.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
