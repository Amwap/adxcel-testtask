import { EventTag } from '@/entities/event'
import { getEvents, getSummary, type AdEvent } from '@/shared/api'
import { formatDateTime, formatNumber, PAGE_SIZES, useListParams, useRequest } from '@/shared/lib'
import {
  Card,
  DataTable,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  type Column,
} from '@/shared/ui'

const missing = <span className="text-slate-400 dark:text-slate-500">No impression</span>

const columns: Column<AdEvent>[] = [
  { key: 'tag', header: 'Event', cell: (r) => <EventTag tag={r.tag} /> },
  {
    key: 'uid',
    header: 'UID',
    cell: (r) => <span className="font-mono text-xs">{r.uid}</span>,
  },
  {
    key: 'time',
    header: 'Impression time',
    cell: (r) =>
      r.reg_time ? <span className="tabular-nums">{formatDateTime(r.reg_time)}</span> : missing,
  },
  { key: 'site', header: 'Site', cell: (r) => r.site_id ?? missing },
]

export function EventsPage() {
  const list = useListParams()
  const { page, pageSize, q } = list
  const tag = list.get('tag')

  const { data, error, loading } = useRequest(`${page}|${pageSize}|${q}|${tag}`, (signal) =>
    getEvents({ page, pageSize, q, tag }, signal),
  )
  const summary = useRequest('summary', getSummary)
  const tagOptions = [
    { value: '', label: 'All events' },
    ...(summary.data?.event_tags ?? []).map((t) => ({
      value: t.tag,
      label: `${t.tag} (${formatNumber(t.count)})`,
    })),
  ]

  return (
    <>
      <PageHeader
        title="Events"
        description="Event log (interview.y.csv). Tags starting with “v” are view-through events."
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row dark:border-slate-800">
          <SearchInput
            value={q}
            onSearch={list.setQuery}
            label="Search events"
            placeholder="UID prefix"
          />
          <Select
            label="Event type"
            value={tag}
            onChange={(e) => list.setFilter('tag', e.target.value)}
            options={tagOptions}
          />
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          loading={loading}
          error={error}
          empty="No events match the filters."
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          pageSizes={PAGE_SIZES}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
        />
      </Card>
    </>
  )
}
