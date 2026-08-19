/**
 * Data chart renderer for the Visual Hub (Recharts, dynamically imported).
 * Supports line / bar / area / pie with Safa's dark cyan theme.
 */

import { useEffect, useState } from 'react';

const PALETTE = ['#00e5ff', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

interface ChartViewProps {
  chartType: 'line' | 'bar' | 'area' | 'pie';
  data: { label: string; value: number }[];
}

export default function ChartView({ chartType, data }: ChartViewProps) {
  const [mod, setMod] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    import('recharts')
      .then(m => {
        if (!cancelled) setMod(m);
      })
      .catch(err => console.error('[VisualHub] Recharts load failed:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mod) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs font-mono tracking-widest text-slate-500 uppercase">
          Preparing chart…
        </p>
      </div>
    );
  }

  const {
    ResponsiveContainer,
    LineChart, Line,
    BarChart, Bar, Cell,
    AreaChart, Area,
    PieChart, Pie,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  } = mod;

  const axisStyle = { fill: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif' };
  const tooltipStyle = {
    backgroundColor: '#0d1117',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    fontSize: 12,
    color: '#e2e8f0',
  };

  return (
    <div className="w-full h-full p-4">
      <div className="w-full h-full max-w-3xl mx-auto rounded-xl border border-white/10 bg-[#0d1117]/60">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius="72%"
                stroke="#0a0a12"
                label={(entry: any) => entry.name}
                labelLine={{ stroke: '#334155' }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            </PieChart>
          ) : chartType === 'bar' ? (
            <BarChart data={data} margin={{ top: 24, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} stroke="#1e293b" />
              <YAxis tick={axisStyle} stroke="#1e293b" />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,229,255,0.05)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          ) : chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 24, right: 24, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="vhAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00e5ff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} stroke="#1e293b" />
              <YAxis tick={axisStyle} stroke="#1e293b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="value" stroke="#00e5ff" strokeWidth={2} fill="url(#vhAreaFill)" />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 24, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} stroke="#1e293b" />
              <YAxis tick={axisStyle} stroke="#1e293b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#00e5ff" strokeWidth={2} dot={{ r: 3, fill: '#00e5ff' }} activeDot={{ r: 5 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
