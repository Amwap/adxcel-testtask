import { DmaLabel, useDmaNames, type DmaNames } from '@/entities/dma'
import { EventTag } from '@/entities/event'
import { segmentFilter } from '@/features/metric-filters'
import { getImpressions, getSummary, type Impression } from '@/shared/api'
import { formatDateTime, PAGE_SIZES, useListParams, useRequest, useTableState } from '@/shared/lib'
import { Card, DataTable, PageHeader, PageSizeSelect, Pagination, type Column } from '@/shared/ui'
import {
  localTimeLabel,
  localTimeOptions,
  priorImpressionsLabel,
  priorImpressionsOptions,
  sinceLastLabel,
  sinceLastOptions,
} from '../lib/codes'

const muted = 'text-slate-400 dark:text-slate-500'
const unknown = <span className={muted}>Unknown</span>

type Options = { value: string; label: string }[]

const columnsFor = (
  os: Options,
  hardware: Options,
  tags: Options,
  dmaNames: DmaNames | undefined,
): Column<Impression>[] => [
  {
    key: 'reg_time',
    header: 'Time',
    hint: 'UTC',
    width: 200,
    filter: { type: 'datetime' },
    cell: (r) => <span className="tabular-nums">{formatDateTime(r.reg_time)}</span>,
  },
  {
    key: 'uid',
    header: 'UID',
    width: 300,
    filter: { type: 'prefix' },
    cell: (r) => <span className="font-mono text-xs">{r.uid}</span>,
  },
  {
    key: 'site_id',
    header: 'Site',
    width: 200,
    filter: segmentFilter('site_id'),
    cell: (r) => r.site_id,
  },
  {
    key: 'mm_dma',
    header: 'DMA',
    hint: '(Code) region',
    width: 300,
    filter: segmentFilter('mm_dma', dmaNames),
    cell: (r) => <DmaLabel code={r.mm_dma} name={dmaNames?.get(r.mm_dma)} />,
  },
  {
    key: 'model',
    header: 'Model',
    width: 150,
    filter: { type: 'text' },
    cell: (r) => r.model ?? unknown,
  },
  {
    key: 'os_name',
    header: 'OS',
    width: 110,
    filter: { type: 'enum', options: os },
    cell: (r) => r.os_name ?? unknown,
  },
  {
    key: 'hardware',
    header: 'Hardware',
    width: 140,
    filter: { type: 'enum', options: hardware },
    cell: (r) => r.hardware ?? unknown,
  },
  {
    key: 'fc_imp_chk',
    header: 'Imps',
    hint: 'Number of prior impressions',
    width: 96,
    filter: { type: 'enum', options: priorImpressionsOptions },
    cell: (r) => priorImpressionsLabel(r.fc_imp_chk),
  },
  {
    key: 'fc_time_chk',
    header: 'Since last',
    hint: 'Time since the previous impression',
    width: 120,
    filter: { type: 'enum', options: sinceLastOptions },
    cell: (r) => sinceLastLabel(r.fc_time_chk),
  },
  {
    key: 'utmtr',
    header: 'Local time',
    hint: "Viewer's local time",
    width: 120,
    filter: { type: 'enum', options: localTimeOptions },
    cell: (r) => <span className="tabular-nums">{localTimeLabel(r.utmtr)}</span>,
  },
  {
    key: 'events',
    header: 'Events',
    hint: 'Filter: has an event of the type. Sort: by the number of events',
    width: 220,
    filter: { type: 'enum', options: tags },
    cell: (r) =>
      r.events.length ? (
        <div className="flex gap-1">
          {r.events.map((tag, i) => (
            <EventTag key={i} tag={tag} />
          ))}
        </div>
      ) : (
        <span className={muted}>—</span>
      ),
  },
]

const toOptions = (values: { value: string }[] = []) =>
  values.map(({ value }) => ({ value, label: value }))

export function ImpressionsPage() {
  const list = useListParams()
  const { page, pageSize } = list
  const summary = useRequest('summary', getSummary)
  const facets = summary.data?.impression_facets
  const dmaNames = useDmaNames()
  const columns = columnsFor(
    toOptions(facets?.os_name),
    toOptions(facets?.hardware),
    (summary.data?.event_tags ?? []).map(({ tag }) => ({ value: tag, label: tag })),
    dmaNames,
  )
  const table = useTableState(columns)

  const key = new URLSearchParams([['p', `${page}|${pageSize}`], ...table.query]).toString()
  const { data, error, loading } = useRequest(key, (signal) =>
    getImpressions({ page, pageSize, filters: table.query }, signal),
  )

  return (
    <>
      <PageHeader
        title="Impressions"
        description="Impression log (interview.X.csv) with the events each impression led to."
      />
      <Card>
        <DataTable
          id="impressions"
          columns={columns}
          state={table}
          rows={data?.items}
          rowKey={(r) => r.id}
          loading={loading}
          error={error}
          empty={
            Object.keys(table.filters).length
              ? 'No impressions match the filters.'
              : 'No impressions yet — run the data sync.'
          }
          toolbar={<PageSizeSelect value={pageSize} sizes={PAGE_SIZES} onChange={list.setPageSize} />}
        />
        <Pagination page={page} pageSize={pageSize} total={data?.total ?? 0} onPageChange={list.setPage} />
      </Card>
    </>
  )
}
