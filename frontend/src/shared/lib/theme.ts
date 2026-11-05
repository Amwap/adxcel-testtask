import { useSyncExternalStore } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ColorScheme = 'light' | 'dark'

// Keep in sync with the pre-paint script in index.html
const STORAGE_KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Storage can be unavailable (private mode, blocked site data) — fall back to the OS
  }
  return 'system'
}

let preference = readPreference()

const resolve = (): ColorScheme =>
  preference === 'system' ? (media.matches ? 'dark' : 'light') : preference

function update() {
  document.documentElement.classList.toggle('dark', resolve() === 'dark')
  listeners.forEach((l) => l())
}

media.addEventListener('change', () => preference === 'system' && update())
// Another tab switched the theme
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return
  preference = readPreference()
  update()
})
update()

export function setThemePreference(next: ThemePreference) {
  preference = next
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Not persisted, but still applied for this page load
  }
  update()
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => void listeners.delete(onChange)
}

/** What the user picked: an explicit scheme or "follow the OS". */
export const useThemePreference = () => useSyncExternalStore(subscribe, () => preference)

/** The scheme in effect, for code that can't use Tailwind's `dark:` variant (e.g. SVG charts). */
export const useColorScheme = () => useSyncExternalStore(subscribe, resolve)
