import { EventTag } from '@/entities/event'
import { getImpressions, type Impression } from '@/shared/api'
import { formatDateTime, PAGE_SIZES, useListParams, useRequest } from '@/shared/lib'
import { Card, DataTable, PageHeader, Pagination, SearchInput, type Column } from '@/shared/ui'
import { localTimeLabel, priorImpressionsLabel, sinceLastLabel } from '../lib/codes'

const muted = 'text-slate-400 dark:text-slate-500'

const columns: Column<Impression>[] = [
  {
    key: 'time',
    header: 'Time',
    cell: (r) => <span className="tabular-nums">{formatDateTime(r.reg_time)}</span>,
  },
  {
    key: 'uid',
    header: 'UID',
    cell: (r) => <span className="font-mono text-xs">{r.uid}</span>,
  },
  { key: 'site', header: 'Site', cell: (r) => r.site_id },
  {
    key: 'dma',
    header: 'DMA',
    cell: (r) => r.mm_dma,
    className: 'text-right tabular-nums',
  },
  {
    key: 'device',
    header: 'Device',
    cell: (r) => (
      <div className="leading-tight">
        <div>{r.model ?? <span className={muted}>Unknown</span>}</div>
        <div className={`text-xs ${muted}`}>
          {[r.os_name, r.hardware].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
    ),
  },
  {
    key: 'freq',
    header: <span title="Number of prior impressions">Imps</span>,
    cell: (r) => priorImpressionsLabel(r.fc_imp_chk),
  },
  {
    key: 'recency',
    header: <span title="Time since the previous impression">Since last</span>,
    cell: (r) => sinceLastLabel(r.fc_time_chk),
  },
  {
    key: 'local',
    header: <span title="Viewer's local time">Local time</span>,
    cell: (r) => <span className="tabular-nums">{localTimeLabel(r.utmtr)}</span>,
  },
  {
    key: 'events',
    header: 'Events',
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

export function ImpressionsPage() {
  const list = useListParams()
  const { page, pageSize, q } = list
  const { data, error, loading } = useRequest(`${page}|${pageSize}|${q}`, (signal) =>
    getImpressions({ page, pageSize, q }, signal),
  )

  return (
    <>
      <PageHeader
        title="Impressions"
        description="Impression log (interview.X.csv) with the events each impression led to."
      />
      <Card>
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <SearchInput
            value={q}
            onSearch={list.setQuery}
            label="Search impressions"
            placeholder="UID prefix, site or device model"
          />
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          loading={loading}
          error={error}
          empty={q ? `No impressions match “${q}”.` : 'No impressions yet — run the data sync.'}
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
