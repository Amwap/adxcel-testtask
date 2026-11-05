import { useMemo, type ReactNode } from 'react'
import { useDmaNames } from '@/entities/dma'
import { ModeSwitch, SegmentPicker, segmentLabel, useMetricParams } from '@/features/metric-filters'
import { getEventTypes, getTimeSeries } from '@/shared/api'
import {
  filterAndSort,
  formatDay,
  formatNumber,
  formatRate,
  useRequest,
  useTableState,
} from '@/shared/lib'
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  SegmentedControl,
  Select,
  Spinner,
  type Column,
} from '@/shared/ui'
import { parsePeriod, toDateInput, toHourParam } from '../model/period'
import {
  buildPoints,
  inRange,
  totalsOf,
  type ChartPoint,
  type Range,
  type Resolution,
} from '../model/series'
import { RateChart, VolumeChart, type RateSeries } from './charts'
import { useChartTheme } from './chartTheme'

const RESOLUTIONS: { value: Resolution; label: string; title: string }[] = [
  { value: 'rolling', label: '24h rolling', title: 'Each hour shows the trailing 24 hours' },
  { value: 'hour', label: 'Hourly', title: 'Raw hourly buckets' },
  { value: 'day', label: 'Daily', title: 'Calendar days, UTC' },
]

const PEAKS: { value: 'cap' | 'full'; label: string; title: string }[] = [
  { value: 'full', label: 'Full scale', title: 'The axis stretches to fit every peak' },
  { value: 'cap', label: 'Capped', title: 'Outliers are drawn as ▲ at the top so the rest stays readable' },
]

const DEFAULT_MIN = 100
const MIN_IMPRESSIONS = [
  { value: '0', label: 'Show all buckets' },
  { value: '100', label: 'Hide under 100 impressions' },
  { value: '500', label: 'Hide under 500 impressions' },
  { value: '1000', label: 'Hide under 1,000 impressions' },
]

const DEFAULT_TAG = 'registration'
const num = 'text-right tabular-nums'
const rate = (v: number | null, unit: '%' | '‰') => (v === null ? '—' : formatRate(v, unit))

const dateInput =
  'rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-indigo-600 focus:outline-none dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:[color-scheme:dark]'

function StatTile({
  label,
  value,
  hint,
  color,
}: {
  label: string
  value: string
  hint: string
  color?: string
}) {
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
        {color && <span className="h-0.5 w-4 rounded-full" style={{ background: color }} />}
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </Card>
  )
}

function ChartHeader({
  title,
  formula,
  children,
}: {
  title: string
  formula: string
  children?: ReactNode
}) {
  return (
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formula}</p>
      </div>
      {children}
    </div>
  )
}

function TagToggle({
  tag,
  color,
  checked,
  onChange,
}: {
  tag: string
  color: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 text-sm select-none ${checked ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer"
        style={{ accentColor: color }}
      />
      <span
        aria-hidden="true"
        className={`h-0.5 w-4 rounded-full ${checked ? '' : 'opacity-30'}`}
        style={{ background: color }}
      />
      {tag}
    </label>
  )
}

export function TrendsPage() {
  const params = useMetricParams()
  const { mode, segment } = params
  const dmaNames = useDmaNames()
  const segmentName = segment?.dimension === 'mm_dma' ? dmaNames?.get(Number(segment.key)) : undefined
  const theme = useChartTheme()

  const resParam = params.get('res') as Resolution
  const resolution: Resolution = RESOLUTIONS.some((r) => r.value === resParam) ? resParam : 'rolling'
  const minParam = params.get('min')
  const minImpressions = minParam === '' ? DEFAULT_MIN : Number(minParam) || 0
  const showPeaks = params.get('peaks') !== 'cap'

  // Every event type comes in one request, so toggling lines never waits on the network
  const requestKey = [mode, segment?.dimension, segment?.key].join('|')
  const { data, error, loading } = useRequest(requestKey, async (signal) => {
    const types = await getEventTypes(signal)
    const tags = types.tags.filter((t) => t !== types.click_tag)
    const series = await getTimeSeries({ tags, mode, granularity: 'hour', segment }, signal)
    return { clickTag: types.click_tag, tags, series }
  })

  const allTags = data?.tags ?? []
  const picked = params.get('tags').split(',').filter((t) => allTags.includes(t))
  const fallback = allTags.includes(DEFAULT_TAG) ? [DEFAULT_TAG] : allTags.slice(0, 1)
  const tags = picked.length ? picked : fallback
  const colorOf = (tag: string) => theme.tag(allTags.indexOf(tag))

  const toggleTag = (tag: string, on: boolean) => {
    const next = allTags.filter((t) => (t === tag ? on : tags.includes(t)))
    // The chart always keeps at least one line
    if (!next.length) return
    const isDefault = next.length === fallback.length && next.every((t) => fallback.includes(t))
    params.setFilter('tags', isDefault ? '' : next.join(','))
  }

  // Period of the charts and totals, kept in the URL
  const range = parsePeriod(params.get('from'), params.get('to'))
  const setPeriod = (next: Range | null) => {
    params.setFilters({
      from: next && Number.isFinite(next.from) ? toHourParam(next.from) : null,
      to: next && Number.isFinite(next.to) ? toHourParam(next.to) : null,
    })
  }

  const allPoints = useMemo(
    () => (data ? buildPoints(data.series.points, data.tags, resolution, minImpressions) : []),
    [data, resolution, minImpressions],
  )
  const points = useMemo(() => inRange(allPoints, range, resolution), [allPoints, range, resolution])
  const totals = useMemo(
    () => (data ? totalsOf(data.series.points, data.tags, range) : null),
    [data, range],
  )
  const bounds = allPoints.length
    ? { first: allPoints[0].t, last: allPoints[allPoints.length - 1].t }
    : null

  const clickTag = data?.clickTag ?? 'fclick'
  const ctrSeries: RateSeries[] = [
    {
      key: 'ctr',
      label: 'CTR',
      color: theme.ctr,
      value: (p) => p.ctr,
      detail: (p) => `${formatNumber(p.clicks)} ${clickTag}`,
    },
  ]
  const evpmSeries: RateSeries[] = tags.map((tag) => ({
    key: tag,
    label: tag,
    color: colorOf(tag),
    value: (p) => p.evpm[tag] ?? null,
    detail: (p) => `${formatNumber(p.events[tag] ?? 0)} ${tag}`,
  }))

  const tableColumns: Column<ChartPoint>[] = [
    {
      key: 't',
      header: resolution === 'rolling' ? 'Hour (24h window)' : 'Period',
      hint: 'UTC',
      width: 220,
      filter: { type: 'datetime' },
      value: (r) => r.t,
      cell: (r) =>
        new Date(r.t)
          .toISOString()
          .slice(0, resolution === 'day' ? 10 : 16)
          .replace('T', ' '),
      className: 'tabular-nums',
    },
    {
      key: 'impressions',
      header: 'Impressions',
      width: 160,
      filter: { type: 'number' },
      value: (r) => r.base,
      cell: (r) => formatNumber(r.base),
      className: num,
    },
    {
      key: 'ctr',
      header: 'CTR',
      hint: 'Percent',
      width: 110,
      filter: { type: 'number' },
      value: (r) => r.ctr,
      cell: (r) => rate(r.ctr, '%'),
      className: num,
    },
    ...tags.map(
      (tag): Column<ChartPoint> => ({
        key: `evpm_${tag}`,
        header: `EvPM · ${tag}`,
        hint: 'Per mille',
        width: 220,
        filter: { type: 'number' },
        value: (r) => r.evpm[tag] ?? null,
        cell: (r) => rate(r.evpm[tag] ?? null, '‰'),
        className: num,
      }),
    ),
  ]
  const table = useTableState(tableColumns)
  const tableRows = filterAndSort(points, tableColumns, table.filters, table.sort)

  return (
    <>
      <PageHeader
        title="Trends"
        description={`${segment ? `${segmentLabel(segment, segmentName)}: CTR` : 'Campaign CTR'} and EvPM over time. Events without a matching impression are excluded.`}
      />

      <Card className="mb-6 flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <SegmentPicker segment={segment} onChange={params.setSegment} />
            <ModeSwitch mode={mode} onChange={params.setMode} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span>Peaks</span>
              <SegmentedControl
                label="Peaks"
                value={showPeaks ? 'full' : 'cap'}
                options={PEAKS}
                onChange={(v) => params.setFilter('peaks', v === 'cap' ? v : '')}
              />
            </div>
            <SegmentedControl
              label="Resolution"
              value={resolution}
              options={RESOLUTIONS}
              onChange={(r) => params.setFilter('res', r === 'rolling' ? '' : r)}
            />
            <Select
              label="Low-volume buckets"
              value={String(minImpressions)}
              onChange={(e) =>
                params.setFilter('min', Number(e.target.value) === DEFAULT_MIN ? '' : e.target.value)
              }
              options={MIN_IMPRESSIONS}
            />
          </div>
        </div>

        {bounds && (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span>Period</span>
              <span className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="From"
                  className={dateInput}
                  min={toDateInput(bounds.first)}
                  max={toDateInput(bounds.last)}
                  value={toDateInput(range?.from ?? bounds.first) || toDateInput(bounds.first)}
                  onChange={(e) =>
                    setPeriod({
                      from: e.target.value ? Date.parse(`${e.target.value}T00:00:00Z`) : -Infinity,
                      to: range?.to ?? Infinity,
                    })
                  }
                />
                –
                <input
                  type="date"
                  aria-label="To"
                  className={dateInput}
                  min={toDateInput(bounds.first)}
                  max={toDateInput(bounds.last)}
                  value={toDateInput(range?.to ?? bounds.last) || toDateInput(bounds.last)}
                  onChange={(e) =>
                    setPeriod({
                      from: range?.from ?? -Infinity,
                      to: e.target.value ? Date.parse(`${e.target.value}T23:00:00Z`) : Infinity,
                    })
                  }
                />
              </span>
              {range && (
                <Button variant="secondary" className="px-3 py-2" onClick={() => setPeriod(null)}>
                  All time
                </Button>
              )}
            </div>
            <fieldset className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              <legend className="sr-only">Event types</legend>
              {allTags.map((tag) => (
                <TagToggle
                  key={tag}
                  tag={tag}
                  color={colorOf(tag)}
                  checked={tags.includes(tag)}
                  onChange={(on) => toggleTag(tag, on)}
                />
              ))}
            </fieldset>
          </div>
        )}
      </Card>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error.message}</p>}

      {!data || !totals ? (
        !error && <Spinner className="mx-auto mt-16 size-6 text-indigo-600" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Impressions"
              value={formatNumber(totals.impressions)}
              hint={
                range && points.length
                  ? `${formatDay(points[0].t)} – ${formatDay(points[points.length - 1].t)}`
                  : `${data.series.points.length} hours with impressions`
              }
            />
            <StatTile
              label="CTR"
              color={theme.ctr}
              value={formatRate(totals.ctr, '%')}
              hint={`${formatNumber(totals.clicks)} first clicks`}
            />
            {tags.map((tag) => (
              <StatTile
                key={tag}
                label={`EvPM · ${tag}`}
                color={colorOf(tag)}
                value={formatRate(totals.evpm[tag] ?? 0, '‰')}
                hint={`${formatNumber(totals.events[tag] ?? 0)} events`}
              />
            ))}
          </div>

          {points.length === 0 ? (
            <Card className="p-10 text-center text-sm text-slate-500">
              Nothing to show in this period with the current threshold.
            </Card>
          ) : (
            <Card className="p-5">
              <ChartHeader title="CTR, %" formula={`100 × ${clickTag} / impressions`} />
              <RateChart
                points={points}
                series={ctrSeries}
                unit="%"
                resolution={resolution}
                minImpressions={minImpressions}
                showPeaks={showPeaks}
                theme={theme}
              />

              <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                <ChartHeader title="EvPM, ‰" formula="1000 × (type + v·type) / impressions" />
                <RateChart
                  points={points}
                  series={evpmSeries}
                  unit="‰"
                  resolution={resolution}
                  minImpressions={minImpressions}
                  showPeaks={showPeaks}
                  theme={theme}
                />
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                <ChartHeader
                  title="Impressions"
                  formula={`Per ${resolution === 'day' ? 'day' : 'hour'}; rates are hidden where volume is under the threshold`}
                />
                <VolumeChart points={points} resolution={resolution} theme={theme} />
              </div>
            </Card>
          )}

          <Card className="mt-6">
            <details>
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700 select-none dark:text-slate-300">
                Data table
              </summary>
              <div className="border-t border-slate-200 dark:border-slate-800">
                <DataTable
                  id="trends"
                  columns={tableColumns}
                  state={table}
                  rows={tableRows}
                  rowKey={(r) => r.t}
                  loading={loading}
                  empty="No rows match the filters."
                  scrollClassName="max-h-96"
                />
              </div>
            </details>
          </Card>
        </>
      )}
    </>
  )
}
