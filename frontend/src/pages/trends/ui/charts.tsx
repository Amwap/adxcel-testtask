import { useMemo, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompact, formatDay, formatHour, formatNumber, formatRate } from '@/shared/lib'
import { niceTicks, outlierCap, type ChartPoint, type Resolution } from '../model/series'
import type { ChartTheme } from './chartTheme'

/** Charts with the same id share the hover cursor and tooltips; points are matched by index. */
const SYNC_ID = 'trends'
const Y_WIDTH = 52
const MARGIN = { top: 12, right: 12, bottom: 0, left: 0 }
const HOUR = 3_600_000
const DAY = 24 * HOUR

export type RateSeries = {
  key: string
  label: string
  color: string
  value: (p: ChartPoint) => number | null
  /** Counts behind the rate, e.g. "312 registration". */
  detail: (p: ChartPoint) => string
}

type Unit = '%' | '‰'

// Daily ticks; every 6 hours once the period is short enough to need them
function useTimeTicks(points: ChartPoint[]) {
  return useMemo(() => {
    const first = points[0]?.t ?? 0
    const last = points[points.length - 1]?.t ?? 0
    const step = last - first <= 3 * DAY ? 6 * HOUR : DAY
    const ticks: number[] = []
    for (let t = Math.ceil(first / step) * step; t <= last; t += step) ticks.push(t)
    return { ticks, format: step < DAY ? formatHour : formatDay }
  }, [points])
}

function TimeAxis({ points, theme }: { points: ChartPoint[]; theme: ChartTheme }) {
  const { ticks, format } = useTimeTicks(points)
  return (
    <XAxis
      dataKey="t"
      type="number"
      scale="time"
      domain={['dataMin', 'dataMax']}
      ticks={ticks}
      tickFormatter={format}
      tick={{ fill: theme.ink, fontSize: 12 }}
      tickLine={false}
      axisLine={{ stroke: theme.axis }}
      minTickGap={24}
    />
  )
}

const bucketLabel = (t: number, resolution: Resolution) =>
  resolution === 'day' ? formatDay(t) : formatHour(t)

function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {children}
    </div>
  )
}

type Payload = ReadonlyArray<{ payload?: unknown }> | undefined
const pointOf = (payload: Payload) => payload?.[0]?.payload as ChartPoint | undefined

function RateTooltip({
  point: p,
  series,
  unit,
  resolution,
  minImpressions,
  cap,
}: {
  point: ChartPoint
  series: RateSeries[]
  unit: Unit
  resolution: Resolution
  minImpressions: number
  cap: number | null
}) {
  const hidden = p.impressions < minImpressions
  return (
    <TooltipBox>
      <p className="font-medium text-slate-900 dark:text-white">
        {bucketLabel(p.t, resolution)}
        {resolution === 'rolling' && (
          <span className="font-normal text-slate-500 dark:text-slate-400"> · last 24 h</span>
        )}
      </p>
      <p className="text-slate-500 tabular-nums dark:text-slate-400">
        {formatNumber(p.base)} impressions
      </p>
      {hidden ? (
        <p className="mt-1.5 text-slate-700 dark:text-slate-300">
          Only {formatNumber(p.impressions)} impressions this{' '}
          {resolution === 'day' ? 'day' : 'hour'}, under the {formatNumber(minImpressions)}{' '}
          threshold
        </p>
      ) : (
        series.map((s) => {
          const v = s.value(p)
          return (
            <div key={s.key} className="mt-1.5 flex items-start gap-2">
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <div className="tabular-nums">
                <p className="text-slate-900 dark:text-white">
                  {s.label}{' '}
                  <span className="font-semibold">{v === null ? '—' : formatRate(v, unit)}</span>
                  {cap !== null && v !== null && v > cap && (
                    <span className="text-slate-500 dark:text-slate-400"> ▲ off scale</span>
                  )}
                </p>
                <p className="text-slate-500 dark:text-slate-400">{s.detail(p)}</p>
              </div>
            </div>
          )
        })
      )}
    </TooltipBox>
  )
}

type DotProps = { cx?: number; cy?: number; index?: number }

/**
 * Line chart of rates on one shared axis. Values past a robust cap are drawn as
 * ▲ markers at the top edge instead of stretching the axis for everything else.
 */
export function RateChart({
  points,
  series,
  unit,
  resolution,
  minImpressions,
  showPeaks,
  theme,
}: {
  points: ChartPoint[]
  series: RateSeries[]
  unit: Unit
  resolution: Resolution
  minImpressions: number
  /** Stretch the axis to fit every value instead of capping the outliers. */
  showPeaks: boolean
  theme: ChartTheme
}) {
  const values = series.flatMap((s) => points.map(s.value))
  const outliers = showPeaks ? null : outlierCap(values)
  const ticks = niceTicks(outliers ?? Math.max(...values.map((v) => v ?? 0)) * 1.05)
  const top = ticks[ticks.length - 1]
  const cap = outliers === null ? null : top

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} syncId={SYNC_ID} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <TimeAxis points={points} theme={theme} />
          <YAxis
            domain={[0, top]}
            ticks={ticks}
            allowDataOverflow={cap !== null}
            tickFormatter={(v: number) => `${Number(v.toPrecision(3))}${unit}`}
            tick={{ fill: theme.ink, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={Y_WIDTH}
          />
          <Tooltip
            cursor={{ stroke: theme.axis, strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const p = pointOf(payload)
              if (!active || !p) return null
              return (
                <RateTooltip
                  point={p}
                  series={series}
                  unit={unit}
                  resolution={resolution}
                  minImpressions={minImpressions}
                  cap={cap}
                />
              )
            }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.value}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: s.color, stroke: theme.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
          {cap !== null &&
            series.map((s) => (
              <Line
                key={`${s.key}-over`}
                dataKey={(p: ChartPoint) => {
                  const v = s.value(p)
                  return v !== null && v > cap ? cap : null
                }}
                stroke="none"
                activeDot={false}
                isAnimationActive={false}
                dot={({ cx, cy, index }: DotProps) =>
                  cx === undefined || cy === undefined ? (
                    <g key={index} />
                  ) : (
                    <path
                      key={index}
                      d={`M${cx},${cy} l5,8 h-10 z`}
                      fill={s.color}
                      stroke={theme.surface}
                      strokeWidth={1.5}
                    />
                  )
                }
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Impressions per bucket, so a jump in a rate can be read against its volume. */
export function VolumeChart({
  points,
  resolution,
  theme,
}: {
  points: ChartPoint[]
  resolution: Resolution
  theme: ChartTheme
}) {
  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} syncId={SYNC_ID} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <TimeAxis points={points} theme={theme} />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fill: theme.ink, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={Y_WIDTH}
            tickCount={3}
          />
          <Tooltip
            cursor={{ stroke: theme.axis, strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const p = pointOf(payload)
              if (!active || !p) return null
              return (
                <TooltipBox>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {bucketLabel(p.t, resolution)}
                  </p>
                  <p className="text-slate-500 tabular-nums dark:text-slate-400">
                    {formatNumber(p.impressions)} impressions this{' '}
                    {resolution === 'day' ? 'day' : 'hour'}
                  </p>
                </TooltipBox>
              )
            }}
          />
          <Area
            type="step"
            dataKey="impressions"
            stroke={theme.volume}
            fill={theme.volume}
            fillOpacity={0.6}
            strokeWidth={1}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
