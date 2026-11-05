import { useSyncExternalStore } from 'react'

const query = '(prefers-color-scheme: dark)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** The OS color scheme, for code that can't use Tailwind's `dark:` variant (e.g. SVG charts). */
export const useColorScheme = () =>
  useSyncExternalStore(subscribe, () => (window.matchMedia(query).matches ? 'dark' : 'light'))
