import { useSession } from '@/entities/session'
import { LogoutButton } from '@/features/auth'
import { useHealth } from '../model/useHealth'

export function HomePage() {
  const status = useHealth()
  const session = useSession()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-semibold">Campaign analytics</span>
          <div className="flex items-center gap-4">
            {session.status === 'authenticated' && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {session.user.username}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm">
          Backend: <code className="font-mono">{status}</code>
        </p>
      </main>
    </div>
  )
}
