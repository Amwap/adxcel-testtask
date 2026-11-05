import { MetricFilters, useMetricParams } from '@/features/metric-filters'
import {
  getAggregates,
  type Dimension,
  type MetricRow,
  type MetricSortField,
} from '@/shared/api'
import { formatNumber, formatRate, PAGE_SIZES, useRequest } from '@/shared/lib'
import {
  Card,
  DataTable,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  Select,
  type Column,
} from '@/shared/ui'

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: 'mm_dma', label: 'DMA' },
  { value: 'site_id', label: 'Site' },
]

const MIN_IMPRESSIONS = [
  { value: '', label: 'Any volume' },
  { value: '100', label: '100+ impressions' },
  { value: '1000', label: '1,000+ impressions' },
  { value: '10000', label: '10,000+ impressions' },
]

const SORT_FIELDS: MetricSortField[] = ['key', 'impressions', 'clicks', 'events', 'ctr', 'evpm']
const num = 'text-right tabular-nums'

export function AggregatesPage() {
  const params = useMetricParams()
  const { tag, mode, page, pageSize, q } = params
  const dimension: Dimension = params.get('dim') === 'site_id' ? 'site_id' : 'mm_dma'
  const sortParam = params.get('sort') as MetricSortField
  const sort: MetricSortField = SORT_FIELDS.includes(sortParam) ? sortParam : 'impressions'
  const desc = params.get('order') !== 'asc'
  const minImpressions = Number(params.get('min')) || 0

  const key = [dimension, tag, mode, page, pageSize, q, sort, desc, minImpressions].join('|')
  const { data, error, loading } = useRequest(key, (signal) =>
    getAggregates(
      dimension,
      {
        tag,
        mode,
        page,
        pageSize,
        q,
        minImpressions,
        sort,
        order: desc ? 'desc' : 'asc',
      },
      signal,
    ),
  )

  const onSort = (field: string) => {
    // A new column starts descending, except the label column; the same column flips
    const nextDesc = field === sort ? !desc : field !== 'key'
    params.setFilters({ sort: field === 'impressions' ? null : field, order: nextDesc ? null : 'asc' })
  }

  const columns: Column<MetricRow>[] = [
    {
      key: 'key',
      header: dimension === 'mm_dma' ? 'DMA' : 'Site',
      sortKey: 'key',
      cell: (r) => (r.key === '' ? 'Total' : r.key),
      className: dimension === 'mm_dma' ? 'tabular-nums' : '',
    },
    {
      key: 'impressions',
      header: 'Impressions',
      sortKey: 'impressions',
      cell: (r) => formatNumber(r.impressions),
      className: num,
    },
    {
      key: 'clicks',
      header: 'Clicks',
      sortKey: 'clicks',
      cell: (r) => formatNumber(r.clicks),
      className: num,
    },
    {
      key: 'ctr',
      header: 'CTR',
      sortKey: 'ctr',
      cell: (r) => formatRate(r.ctr, '%'),
      className: num,
    },
    {
      key: 'events',
      header: `Events · ${tag}`,
      sortKey: 'events',
      cell: (r) => formatNumber(r.events),
      className: num,
    },
    {
      key: 'evpm',
      header: 'EvPM',
      sortKey: 'evpm',
      cell: (r) => formatRate(r.evpm, '‰'),
      className: num,
    },
  ]

  return (
    <>
      <PageHeader
        title="Aggregates"
        description="Impressions, CTR and EvPM per DMA or site. Events without a matching impression are excluded."
      />

      <Card className="mb-6 flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <MetricFilters
          tag={tag}
          mode={mode}
          onTagChange={params.setTag}
          onModeChange={params.setMode}
        />
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center dark:border-slate-800">
          <SegmentedControl
            label="Group by"
            value={dimension}
            options={DIMENSIONS}
            onChange={(d) => params.setFilters({ dim: d === 'mm_dma' ? null : d, q: null })}
          />
          <SearchInput
            key={dimension}
            value={q}
            onSearch={params.setQuery}
            label={dimension === 'mm_dma' ? 'Filter DMAs' : 'Filter sites'}
            placeholder={dimension === 'mm_dma' ? 'DMA code' : 'Site name'}
          />
          <Select
            label="Minimum impressions"
            value={minImpressions ? String(minImpressions) : ''}
            onChange={(e) => params.setFilter('min', e.target.value)}
            options={MIN_IMPRESSIONS}
          />
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.key}
          loading={loading}
          error={error}
          sort={{ key: sort, desc }}
          onSort={onSort}
          footer={data ? { key: '', ...data.totals } : undefined}
          empty="Nothing matches the filters."
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          pageSizes={PAGE_SIZES}
          onPageChange={params.setPage}
          onPageSizeChange={params.setPageSize}
        />
      </Card>
    </>
  )
}
