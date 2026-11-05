import { EventTag } from '@/entities/event'
import { segmentFilter } from '@/features/metric-filters'
import { getEvents, getSummary, type AdEvent } from '@/shared/api'
import {
  formatDateTime,
  formatNumber,
  PAGE_SIZES,
  useListParams,
  useRequest,
  useTableState,
} from '@/shared/lib'
import { Card, DataTable, PageHeader, PageSizeSelect, Pagination, type Column } from '@/shared/ui'

const missing = <span className="text-slate-400 dark:text-slate-500">No impression</span>

const columnsFor = (tags: { value: string; label: string }[]): Column<AdEvent>[] => [
  {
    key: 'tag',
    header: 'Event',
    width: 150,
    filter: { type: 'enum', options: tags },
    cell: (r) => <EventTag tag={r.tag} />,
  },
  {
    key: 'uid',
    header: 'UID',
    width: 300,
    filter: { type: 'prefix' },
    cell: (r) => <span className="font-mono text-xs">{r.uid}</span>,
  },
  {
    key: 'reg_time',
    header: 'Impression time',
    hint: 'Earliest impression with this UID, UTC',
    width: 210,
    filter: { type: 'datetime' },
    cell: (r) =>
      r.reg_time ? <span className="tabular-nums">{formatDateTime(r.reg_time)}</span> : missing,
  },
  {
    key: 'site_id',
    header: 'Site',
    hint: 'Of the earliest impression with this UID',
    width: 220,
    filter: segmentFilter('site_id'),
    cell: (r) => r.site_id ?? missing,
  },
]

export function EventsPage() {
  const list = useListParams()
  const { page, pageSize } = list
  const summary = useRequest('summary', getSummary)
  const columns = columnsFor(
    (summary.data?.event_tags ?? []).map((t) => ({
      value: t.tag,
      label: `${t.tag} (${formatNumber(t.count)})`,
    })),
  )
  const table = useTableState(columns)

  const key = new URLSearchParams([['p', `${page}|${pageSize}`], ...table.query]).toString()
  const { data, error, loading } = useRequest(key, (signal) =>
    getEvents({ page, pageSize, filters: table.query }, signal),
  )

  return (
    <>
      <PageHeader
        title="Events"
        description="Event log (interview.y.csv). Tags starting with “v” are view-through events."
      />
      <Card>
        <DataTable
          id="events"
          columns={columns}
          state={table}
          rows={data?.items}
          rowKey={(r) => r.id}
          loading={loading}
          error={error}
          empty="No events match the filters."
          toolbar={<PageSizeSelect value={pageSize} sizes={PAGE_SIZES} onChange={list.setPageSize} />}
        />
        <Pagination page={page} pageSize={pageSize} total={data?.total ?? 0} onPageChange={list.setPage} />
      </Card>
    </>
  )
}
