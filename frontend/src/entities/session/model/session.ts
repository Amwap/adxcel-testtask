import { useSyncExternalStore } from 'react'
import { getMe, login, logout, onSessionExpired, refreshAccessToken, type User } from '@/shared/api'

export type Session =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: User }

let session: Session = { status: 'loading' }
const listeners = new Set<() => void>()

function setSession(next: Session) {
  session = next
  listeners.forEach((fn) => fn())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

onSessionExpired(() => setSession({ status: 'anonymous' }))

export const useSession = () => useSyncExternalStore(subscribe, () => session)

let restoring: Promise<void> | null = null

/** Restores the session from the refresh cookie on page load. Safe to call repeatedly. */
export function restoreSession() {
  restoring ??= (async () => {
    try {
      if (await refreshAccessToken()) {
        setSession({ status: 'authenticated', user: await getMe() })
        return
      }
    } catch {
      // fall through to anonymous
    }
    setSession({ status: 'anonymous' })
  })()
  return restoring
}

export async function signIn(username: string, password: string) {
  await login(username, password)
  setSession({ status: 'authenticated', user: await getMe() })
}

export async function signOut() {
  try {
    await logout()
  } finally {
    setSession({ status: 'anonymous' })
  }
}
