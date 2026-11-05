import type { ReactNode } from 'react'

type Tone = 'indigo' | 'sky' | 'slate'

const tones: Record<Tone, string> = {
  indigo:
    'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/30',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30',
  slate:
    'bg-slate-50 text-slate-600 ring-slate-500/20 dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/20',
}

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
