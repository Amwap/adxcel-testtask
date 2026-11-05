import { API_BASE_URL } from '@/shared/config'

export type TokenResponse = { access_token: string; token_type: 'bearer'; expires_in: number }

// The access token lives only in memory; the refresh token is an httpOnly cookie set by the API.
let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null
const expiredListeners = new Set<() => void>()

export const getAccessToken = () => accessToken

export function setAccessToken(token: string | null) {
  accessToken = token
}

/** Called when the refresh token is rejected, i.e. the user has to sign in again. */
export function onSessionExpired(listener: () => void) {
  expiredListeners.add(listener)
  return () => {
    expiredListeners.delete(listener)
  }
}

/** Exchanges the refresh cookie for a new access token. Concurrent calls share one request. */
export function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST' })
      if (!res.ok) {
        accessToken = null
        expiredListeners.forEach((fn) => fn())
        return false
      }
      accessToken = ((await res.json()) as TokenResponse).access_token
      return true
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}
