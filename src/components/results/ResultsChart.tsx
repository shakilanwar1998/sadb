import { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend
} from 'recharts';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, Activity, Sparkles } from 'lucide-react';
import type { QueryResult } from '@shared/types';
import { Select } from '@/components/ui/Select';
import { cn, isLikelyNumeric } from '@/lib/utils';

type ChartKind = 'bar' | 'line' | 'area' | 'pie';

const PALETTE = ['#7c5cff', '#22d3ee', '#34e3b1', '#ffb547', '#ff5d8f', '#a855f7', '#38bdf8'];

const chartKinds: { kind: ChartKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: 'bar', label: 'Bar', icon: BarChart3 },
  { kind: 'line', label: 'Line', icon: LineIcon },
  { kind: 'area', label: 'Area', icon: Activity },
  { kind: 'pie', label: 'Pie', icon: PieIcon }
];

export function ResultsChart({ result }: { result: QueryResult }) {
  const allCols = result.columns.map((c) => c.name);
  const numericCols = useMemo(
    () =>
      result.columns
        .filter((c) => {
          if (c.type === 'number') return true;
          return isLikelyNumeric(result.rows.map((r) => r[c.name]));
        })
        .map((c) => c.name),
    [result]
  );
  const labelCols = allCols.filter((c) => !numericCols.includes(c)).length
    ? allCols.filter((c) => !numericCols.includes(c))
    : allCols;

  const [kind, setKind] = useState<ChartKind>('bar');
  const [xKey, setXKey] = useState<string>(labelCols[0] ?? allCols[0] ?? '');
  const [yKey, setYKey] = useState<string>(numericCols[0] ?? allCols[1] ?? '');

  useEffect(() => {
    if (!xKey && labelCols[0]) setXKey(labelCols[0]);
    if (!yKey && numericCols[0]) setYKey(numericCols[0]);
  }, [xKey, yKey, labelCols, numericCols]);

  const chartData = useMemo(() => {
    return result.rows.slice(0, 200).map((r) => ({
      ...r,
      [xKey]: String(r[xKey] ?? ''),
      [yKey]: Number(r[yKey] ?? 0)
    }));
  }, [result.rows, xKey, yKey]);

  if (result.rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-dim text-sm">
        Run a query that returns rows to visualize.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-bg-1/60 backdrop-blur">
        <Sparkles className="w-3.5 h-3.5 text-brand-400" />
        <span className="text-xs text-ink-dim">Visualize</span>
        <div className="ml-2 flex items-center gap-1">
          {chartKinds.map((c) => (
            <button
              key={c.kind}
              onClick={() => setKind(c.kind)}
              className={cn(
                'h-7 px-2 rounded-md text-xs flex items-center gap-1 transition',
                kind === c.kind
                  ? 'bg-brand/20 text-brand-400 border border-brand/30'
                  : 'text-ink-dim hover:bg-bg-3 border border-transparent'
              )}
            >
              <c.icon className="w-3.5 h-3.5" />
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-40">
            <Select
              value={xKey}
              onChange={(e) => setXKey(e.target.value)}
              options={allCols.map((c) => ({ value: c, label: `X · ${c}` }))}
            />
          </div>
          <div className="w-40">
            <Select
              value={yKey}
              onChange={(e) => setYKey(e.target.value)}
              options={allCols.map((c) => ({ value: c, label: `Y · ${c}` }))}
            />
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-4">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(kind, chartData, xKey, yKey)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderChart(kind: ChartKind, data: Array<Record<string, unknown>>, xKey: string, yKey: string) {
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
      <XAxis
        dataKey={xKey}
        stroke="#5b6178"
        tick={{ fill: '#9097ac', fontSize: 11 }}
        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
      />
      <YAxis stroke="#5b6178" tick={{ fill: '#9097ac', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
      <Tooltip
        contentStyle={{
          background: '#11141d',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          color: '#e6e9f2',
          fontSize: 12
        }}
        cursor={{ fill: 'rgba(124,92,255,0.08)' }}
      />
    </>
  );

  switch (kind) {
    case 'bar':
      return (
        <BarChart data={data}>
          {common}
          <Bar dataKey={yKey} fill="#7c5cff" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      );
    case 'line':
      return (
        <LineChart data={data}>
          {common}
          <Line
            type="monotone"
            dataKey={yKey}
            stroke="#7c5cff"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#22d3ee' }}
            activeDot={{ r: 5, fill: '#7c5cff' }}
          />
        </LineChart>
      );
    case 'area':
      return (
        <AreaChart data={data}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
            </linearGradient>
          </defs>
          {common}
          <Area type="monotone" dataKey={yKey} stroke="#7c5cff" strokeWidth={2} fill="url(#grad)" />
        </AreaChart>
      );
    case 'pie':
      return (
        <PieChart>
          <Tooltip
            contentStyle={{
              background: '#11141d',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: '#e6e9f2',
              fontSize: 12
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9097ac' }} />
          <Pie
            data={data}
            dataKey={yKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius="75%"
            innerRadius="45%"
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="#0c0e15" />
            ))}
          </Pie>
        </PieChart>
      );
  }
}
