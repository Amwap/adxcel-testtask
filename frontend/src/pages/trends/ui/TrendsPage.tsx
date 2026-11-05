import type { ReactNode } from 'react'
import { MetricFilters, useMetricParams } from '@/features/metric-filters'
import { getTimeSeries, type Granularity, type TimePoint } from '@/shared/api'
import { formatDateTime, formatNumber, formatRate, useRequest } from '@/shared/lib'
import { Card, DataTable, PageHeader, SegmentedControl, Spinner, type Column } from '@/shared/ui'
import { MetricChart } from './MetricChart'

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
]

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </Card>
  )
}

function ChartCard({
  title,
  formula,
  loading,
  children,
}: {
  title: string
  formula: string
  loading: boolean
  children: ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formula}</p>
        </div>
        {loading && <Spinner className="size-4 text-indigo-600" />}
      </div>
      {children}
    </Card>
  )
}

export function TrendsPage() {
  const params = useMetricParams()
  const { tag, mode } = params
  const granularity: Granularity = params.get('granularity') === 'day' ? 'day' : 'hour'

  const { data, error, loading } = useRequest(`${tag}|${mode}|${granularity}`, (signal) =>
    getTimeSeries({ tag, mode, granularity }, signal),
  )

  const tableColumns: Column<TimePoint>[] = [
    { key: 'ts', header: 'Period', cell: (r) => formatDateTime(r.ts) },
    {
      key: 'imp',
      header: 'Impressions',
      cell: (r) => formatNumber(r.impressions),
      className: 'text-right tabular-nums',
    },
    {
      key: 'ctr',
      header: 'CTR',
      cell: (r) => formatRate(r.ctr, '%'),
      className: 'text-right tabular-nums',
    },
    {
      key: 'evpm',
      header: `EvPM (${tag})`,
      cell: (r) => formatRate(r.evpm, '‰'),
      className: 'text-right tabular-nums',
    },
  ]

  return (
    <>
      <PageHeader
        title="Trends"
        description="Campaign CTR and EvPM over time. Events without a matching impression are excluded."
      />

      <Card className="mb-6 flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <MetricFilters
          tag={tag}
          mode={mode}
          onTagChange={params.setTag}
          onModeChange={params.setMode}
        />
        <SegmentedControl
          label="Granularity"
          value={granularity}
          options={GRANULARITIES}
          onChange={(g) => params.setFilter('granularity', g === 'hour' ? '' : g)}
        />
      </Card>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error.message}</p>}

      {!data ? (
        !error && <Spinner className="mx-auto mt-16 size-6 text-indigo-600" />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Impressions"
              value={formatNumber(data.totals.impressions)}
              hint={`${data.points.length} ${granularity === 'hour' ? 'hours' : 'days'}`}
            />
            <StatTile
              label="CTR"
              value={formatRate(data.totals.ctr, '%')}
              hint={`${formatNumber(data.totals.clicks)} first clicks`}
            />
            <StatTile
              label={`EvPM · ${tag}`}
              value={formatRate(data.totals.evpm, '‰')}
              hint={`${formatNumber(data.totals.events)} events`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard title="CTR, %" formula="100 × fclick / impressions" loading={loading}>
              <MetricChart
                points={data.points}
                metric="ctr"
                unit="%"
                numeratorLabel="fclick"
                granularity={granularity}
              />
            </ChartCard>
            <ChartCard
              title={`EvPM · ${tag}, ‰`}
              formula={`1000 × (${tag} + v${tag}) / impressions`}
              loading={loading}
            >
              <MetricChart
                points={data.points}
                metric="evpm"
                unit="‰"
                numeratorLabel={tag}
                granularity={granularity}
              />
            </ChartCard>
          </div>

          <Card className="mt-6">
            <details>
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700 select-none dark:text-slate-300">
                Data table
              </summary>
              <div className="max-h-96 overflow-y-auto border-t border-slate-200 dark:border-slate-800">
                <DataTable
                  columns={tableColumns}
                  rows={data.points}
                  rowKey={(r) => r.ts}
                  loading={loading}
                />
              </div>
            </details>
          </Card>
        </>
      )}
    </>
  )
}
