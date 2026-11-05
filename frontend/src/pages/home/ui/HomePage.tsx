import { Link } from 'react-router'
import { EventTag, isViewThrough } from '@/entities/event'
import { getSummary } from '@/shared/api'
import { formatDateTime, formatNumber, useRequest } from '@/shared/lib'
import { Card, PageHeader, Spinner } from '@/shared/ui'

const TABLE_LINKS: Record<string, string> = { impressions: '/impressions', events: '/events' }

export function HomePage() {
  const { data, error } = useRequest('summary', getSummary)

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
  if (!data) return <Spinner className="mx-auto mt-16 size-6 text-indigo-600" />

  const maxTag = Math.max(1, ...data.event_tags.map((t) => t.count))

  return (
    <>
      <PageHeader title="Overview" description="Data synced from the analysts’ CSV exports." />

      {data.sources.length === 0 ? (
        <Card className="p-6 text-sm text-slate-600 dark:text-slate-400">
          No data synced yet. Put the CSV files into <code>backend/data/</code> and run{' '}
          <code className="font-mono">python -m scripts.sync_data</code>.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.sources.map((s) => (
            <Link
              key={s.table}
              to={TABLE_LINKS[s.table] ?? '/'}
              className="rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <Card className="p-5 transition-colors hover:border-indigo-300 dark:hover:border-indigo-700">
                <p className="text-sm font-medium text-slate-500 capitalize dark:text-slate-400">
                  {s.table}
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                  {formatNumber(s.rows)}
                </p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono">{s.file_name}</span> · synced{' '}
                  {formatDateTime(s.synced_at)} UTC
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {data.event_tags.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="text-sm font-semibold">Events by type</h2>
          <ul className="mt-4 space-y-2.5">
            {data.event_tags.map((t) => (
              <li key={t.tag} className="grid grid-cols-[7.5rem_1fr_4rem] items-center gap-3">
                <Link to={`/events?tag=${encodeURIComponent(t.tag)}`}>
                  <EventTag tag={t.tag} />
                </Link>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${isViewThrough(t.tag) ? 'bg-sky-500' : 'bg-indigo-500'}`}
                    style={{ width: `${(t.count / maxTag) * 100}%` }}
                  />
                </div>
                <span className="text-right text-sm tabular-nums">{formatNumber(t.count)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
