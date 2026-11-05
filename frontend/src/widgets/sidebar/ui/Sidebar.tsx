import { useEffect, useState, type ComponentType } from 'react'
import { NavLink } from 'react-router'
import { useSession } from '@/entities/session'
import { LogoutButton } from '@/features/auth'
import { ThemeSwitcher } from '@/features/theme-switcher'
import {
  AggregatesIcon,
  CloseIcon,
  CollapseIcon,
  EventsIcon,
  ExpandIcon,
  ImpressionsIcon,
  MenuIcon,
  OverviewIcon,
  TrendsIcon,
} from './icons'

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> }

const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: OverviewIcon },
  { to: '/trends', label: 'Trends', icon: TrendsIcon },
  { to: '/aggregates', label: 'Aggregates', icon: AggregatesIcon },
  { to: '/impressions', label: 'Impressions', icon: ImpressionsIcon },
  { to: '/events', label: 'Events', icon: EventsIcon },
]

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt={compact ? 'Campaign analytics' : ''} className="size-7 shrink-0" />
      {!compact && (
        <span className="truncate font-semibold text-slate-900 dark:text-white">Campaign analytics</span>
      )}
    </div>
  )
}

const iconButton =
  'shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'

type SidebarContentProps = {
  onNavigate?: () => void
  /** Icons only: labels move to tooltips. */
  collapsed?: boolean
  /** Shown on the desktop sidebar only; the drawer has its own close button. */
  onToggle?: () => void
}

function SidebarContent({ onNavigate, collapsed = false, onToggle }: SidebarContentProps) {
  const session = useSession()

  return (
    <div className={`flex h-full flex-col gap-6 py-5 ${collapsed ? 'px-2' : 'px-4'}`}>
      {onToggle && (
        <div
          className={`flex gap-2 ${collapsed ? 'flex-col items-center' : 'items-center justify-between px-2'}`}
        >
          <Brand compact={collapsed} />
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={iconButton}
          >
            {collapsed ? <ExpandIcon className="size-4" /> : <CollapseIcon className="size-4" />}
          </button>
        </div>
      )}

      <nav aria-label="Main" className="flex-1">
        <ul className="space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors ${
                    collapsed ? 'justify-center px-0' : 'px-3'
                  } ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`
                }
              >
                <Icon className="size-5 shrink-0" />
                <span className={collapsed ? 'sr-only' : ''}>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {collapsed ? (
        <div className="flex justify-center">
          <ThemeSwitcher vertical />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-2">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Theme</span>
          <ThemeSwitcher />
        </div>
      )}

      <div
        className={`flex gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 ${
          collapsed ? 'flex-col items-center' : 'items-center justify-between px-2'
        }`}
      >
        {session.status === 'authenticated' && (
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              title={collapsed ? session.user.username : undefined}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 uppercase dark:bg-indigo-500/20 dark:text-indigo-300"
            >
              {session.user.username.slice(0, 1)}
            </span>
            <span
              className={
                collapsed ? 'sr-only' : 'truncate text-sm font-medium text-slate-700 dark:text-slate-300'
              }
            >
              {session.user.username}
            </span>
          </div>
        )}
        <LogoutButton />
      </div>
    </div>
  )
}

type SidebarProps = {
  /** Desktop only: the sidebar shrinks to a column of icons. */
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

/** Fixed sidebar on large screens, a drawer behind a menu button on small ones. */
export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="cursor-pointer rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <MenuIcon className="size-6" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <CloseIcon />
            </button>
            <div className="px-6 pt-5">
              <Brand />
            </div>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-20 hidden overflow-x-hidden overflow-y-auto border-r border-slate-200 bg-white transition-[width] lg:block dark:border-slate-800 dark:bg-slate-900 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarContent collapsed={collapsed} onToggle={() => onCollapsedChange(!collapsed)} />
      </aside>
    </>
  )
}
