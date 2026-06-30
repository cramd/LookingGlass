'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface MetricPoint {
  timestamp: string;
  cpu: number;
  memory: number;
}

interface MetricsChartProps {
  data: MetricPoint[];
}

export default function MetricsChart({ data }: MetricsChartProps) {
  // Format the timestamp for the X-axis
  const formattedData = data.map(d => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cpu: Math.round(d.cpu * 10) / 10,
    memory: Math.round(d.memory * 10) / 10,
  }));

  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
        No metrics data available
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-100">Resource Utilization</h3>
        <p className="text-sm text-zinc-500">CPU and Memory metrics over time</p>
      </div>
      
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={formattedData}
            margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
            <XAxis 
              dataKey="time" 
              stroke="#52525b" 
              fontSize={12} 
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />
            <YAxis 
              stroke="#52525b" 
              fontSize={12} 
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              itemStyle={{ color: '#e4e4e7' }}
              formatter={(value) => [`${Number(value).toFixed(1)}%`, undefined]}
            />
            <Area 
              type="monotone" 
              dataKey="cpu" 
              name="CPU (%)"
              stroke="#6366f1" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorCpu)" 
            />
            <Area
              type="monotone"
              dataKey="memory"
              name="Memory (%)"
              stroke="#14b8a6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMemory)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
