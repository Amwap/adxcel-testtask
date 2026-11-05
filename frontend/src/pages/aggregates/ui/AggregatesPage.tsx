import { MetricFilters, useMetricParams } from '@/features/metric-filters'
import { getAggregates, type Dimension, type MetricRow } from '@/shared/api'
import { formatNumber, formatRate, PAGE_SIZES, useRequest, useTableState } from '@/shared/lib'
import {
  Card,
  DataTable,
  PageHeader,
  PageSizeSelect,
  Pagination,
  SegmentedControl,
  type Column,
} from '@/shared/ui'

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: 'mm_dma', label: 'DMA' },
  { value: 'site_id', label: 'Site' },
]

const DEFAULT_SORT = { key: 'impressions', desc: true }
const num = 'text-right tabular-nums'

const columnsFor = (dimension: Dimension, tag: string): Column<MetricRow>[] => [
  dimension === 'mm_dma'
    ? {
        key: 'key',
        header: 'DMA',
        width: 110,
        filter: { type: 'number' },
        cell: (r) => (r.key === '' ? 'Total' : r.key),
        className: 'tabular-nums',
      }
    : {
        key: 'key',
        header: 'Site',
        width: 260,
        filter: { type: 'text' },
        cell: (r) => (r.key === '' ? 'Total' : r.key),
      },
  {
    key: 'impressions',
    header: 'Impressions',
    width: 160,
    filter: { type: 'number' },
    cell: (r) => formatNumber(r.impressions),
    className: num,
  },
  {
    key: 'clicks',
    header: 'Clicks',
    width: 110,
    filter: { type: 'number' },
    cell: (r) => formatNumber(r.clicks),
    className: num,
  },
  {
    key: 'ctr',
    header: 'CTR',
    hint: 'Percent',
    width: 110,
    filter: { type: 'number' },
    cell: (r) => formatRate(r.ctr, '%'),
    className: num,
  },
  {
    key: 'events',
    header: `Events · ${tag}`,
    width: 200,
    filter: { type: 'number' },
    cell: (r) => formatNumber(r.events),
    className: num,
  },
  {
    key: 'evpm',
    header: 'EvPM',
    hint: 'Per mille',
    width: 110,
    filter: { type: 'number' },
    cell: (r) => formatRate(r.evpm, '‰'),
    className: num,
  },
]

export function AggregatesPage() {
  const params = useMetricParams()
  const { tag, mode, page, pageSize } = params
  const dimension: Dimension = params.get('dim') === 'site_id' ? 'site_id' : 'mm_dma'
  const columns = columnsFor(dimension, tag)
  const table = useTableState(columns, DEFAULT_SORT)

  const key = new URLSearchParams([
    ['p', [dimension, tag, mode, page, pageSize].join('|')],
    ...table.query,
  ]).toString()
  const { data, error, loading } = useRequest(key, (signal) =>
    getAggregates(dimension, { tag, mode, page, pageSize, filters: table.query }, signal),
  )

  return (
    <>
      <PageHeader
        title="Aggregates"
        description="Impressions, CTR and EvPM per DMA or site. Events without a matching impression are excluded."
      />

      <Card>
        <DataTable
          id={`aggregates-${dimension}`}
          columns={columns}
          state={table}
          rows={data?.items}
          rowKey={(r) => r.key}
          loading={loading}
          error={error}
          footer={data ? { key: '', ...data.totals } : undefined}
          empty="Nothing matches the filters."
          toolbar={
            <>
              <SegmentedControl
                label="Group by"
                value={dimension}
                options={DIMENSIONS}
                // The key filter is a number for DMAs and text for sites
                onChange={(d) =>
                  params.setFilters({
                    dim: d === 'mm_dma' ? null : d,
                    key: null,
                    key_min: null,
                    key_max: null,
                  })
                }
              />
              <MetricFilters
                tag={tag}
                mode={mode}
                onTagChange={params.setTag}
                onModeChange={params.setMode}
              />
              <PageSizeSelect value={pageSize} sizes={PAGE_SIZES} onChange={params.setPageSize} />
            </>
          }
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onPageChange={params.setPage}
        />
      </Card>
    </>
  )
}
