import type { ReactNode } from 'react'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  )
}

export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
    </div>
  )
}
