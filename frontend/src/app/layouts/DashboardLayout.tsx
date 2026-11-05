import { Outlet } from 'react-router'
import { Sidebar } from '@/widgets/sidebar'

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
