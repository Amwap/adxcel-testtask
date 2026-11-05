import type { ReactNode } from 'react'
import { setThemePreference, useThemePreference, type ThemePreference } from '@/shared/lib'
import { SegmentedControl } from '@/shared/ui'

function Icon({ d }: { d: string }) {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Light theme',
    icon: (
      <Icon d="M12 3v2.25m6.36.39-1.59 1.59M21 12h-2.25m-.39 6.36-1.59-1.59M12 18.75V21m-4.77-4.23-1.59 1.59M5.25 12H3m4.23-4.77L5.64 5.64M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    ),
  },
  {
    value: 'dark',
    label: 'Dark theme',
    icon: (
      <Icon d="M21.75 15A9.72 9.72 0 0 1 18 15.75 9.75 9.75 0 0 1 8.25 6c0-1.33.27-2.6.75-3.75A9.75 9.75 0 0 0 12 21.75c4.07 0 7.56-2.5 9.02-6.04Z" />
    ),
  },
  {
    value: 'system',
    label: 'System theme',
    icon: (
      <Icon d="M9 17.25v1.01a3 3 0 0 1-.88 2.12L7.5 21h9l-.62-.62A3 3 0 0 1 15 18.26v-1.01m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
    ),
  },
]

/** `vertical` stacks the options, for a narrow (collapsed) sidebar. */
export function ThemeSwitcher({ vertical = false }: { vertical?: boolean }) {
  return (
    <SegmentedControl
      label="Color theme"
      layout={vertical ? 'vertical' : 'inline'}
      value={useThemePreference()}
      options={OPTIONS}
      onChange={setThemePreference}
    />
  )
}
