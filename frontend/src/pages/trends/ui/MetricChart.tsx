import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Granularity, TimePoint } from '@/shared/api'
import {
  formatDay,
  formatHour,
  formatNumber,
  formatRate,
  parseApiDate,
  useColorScheme,
} from '@/shared/lib'

// Single-series chart: one blue step per scheme, chrome in the app's slate grays
const THEME = {
  light: { series: '#2a78d6', surface: '#ffffff', grid: '#e2e8f0', axis: '#cbd5e1', ink: '#64748b' },
  dark: { series: '#3987e5', surface: '#0f172a', grid: '#1e293b', axis: '#334155', ink: '#94a3b8' },
}

type Metric = 'ctr' | 'evpm'

type MetricChartProps = {
  points: TimePoint[]
  metric: Metric
  unit: '%' | '‰'
  /** Name of the numerator in the tooltip, e.g. "fclick". */
  numeratorLabel: string
  granularity: Granularity
}

type Datum = TimePoint & { t: number }

function ChartTooltip({
  active,
  payload,
  metric,
  unit,
  numeratorLabel,
  granularity,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: unknown }>
} & Omit<MetricChartProps, 'points'>) {
  const d = payload?.[0]?.payload as Datum | undefined
  if (!active || !d) return null
  const numerator = metric === 'ctr' ? d.clicks : d.events

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="font-medium text-slate-900 dark:text-white">
        {granularity === 'hour' ? formatHour(d.t) : formatDay(d.t)}
      </p>
      <p className="mt-1 text-base font-semibold text-slate-900 tabular-nums dark:text-white">
        {formatRate(d[metric], unit)}
      </p>
      <p className="mt-0.5 text-slate-500 tabular-nums dark:text-slate-400">
        {formatNumber(numerator)} {numeratorLabel} / {formatNumber(d.impressions)} impressions
      </p>
    </div>
  )
}

export function MetricChart({ points, metric, unit, numeratorLabel, granularity }: MetricChartProps) {
  const theme = THEME[useColorScheme()]
  const data = useMemo<Datum[]>(() => points.map((p) => ({ ...p, t: parseApiDate(p.ts) })), [points])
  // One tick per day, whatever the bucket size
  const ticks = useMemo(
    () => [...new Set(data.map((d) => d.t - (d.t % 86_400_000)))].filter((t) => t >= data[0]?.t),
    [data],
  )
  const tick = { fill: theme.ink, fontSize: 12 }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={ticks}
            tickFormatter={formatDay}
            tick={tick}
            tickLine={false}
            axisLine={{ stroke: theme.axis }}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => formatRate(v, unit, v < 10 ? 1 : 0)}
            tick={tick}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: theme.axis, strokeWidth: 1 }}
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                payload={payload}
                metric={metric}
                unit={unit}
                numeratorLabel={numeratorLabel}
                granularity={granularity}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke={theme.series}
            strokeWidth={2}
            fill={theme.series}
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 4, fill: theme.series, stroke: theme.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
