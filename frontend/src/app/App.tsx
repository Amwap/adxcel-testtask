import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { restoreSession, useSession } from '@/entities/session'
import { LoginPage } from '@/pages/login'
import { Spinner } from '@/shared/ui'
import { router } from './router'

export function App() {
  const session = useSession()

  useEffect(() => {
    void restoreSession()
  }, [])

  if (session.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-indigo-600 dark:bg-slate-950">
        <Spinner />
      </div>
    )
  }

  return session.status === 'authenticated' ? <RouterProvider router={router} /> : <LoginPage />
}
