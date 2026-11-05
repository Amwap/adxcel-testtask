import { Outlet } from 'react-router'
import { useStoredFlag } from '@/shared/lib'
import { Sidebar } from '@/widgets/sidebar'

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useStoredFlag('sidebar-collapsed', false)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
      <main
        className={`px-4 py-6 transition-[margin] sm:px-6 lg:px-8 lg:py-8 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}
      >
        <Outlet />
      </main>
    </div>
  )
}
