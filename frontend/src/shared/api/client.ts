import { API_BASE_URL } from '@/shared/config'
import { getAccessToken, refreshAccessToken } from './token'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function send(path: string, init: RequestInit) {
  const headers = new Headers(init.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers })
}

async function errorMessage(res: Response) {
  const text = await res.text()
  try {
    const { detail } = JSON.parse(text) as { detail?: unknown }
    if (typeof detail === 'string') return detail
  } catch {
    // not JSON
  }
  return text || res.statusText
}

/** Fetch wrapper: attaches the access token and retries once after refreshing it on 401. */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init)
  if (res.status === 401 && getAccessToken() && (await refreshAccessToken())) {
    res = await send(path, init)
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const apiGet = <T,>(path: string, init?: RequestInit) => apiRequest<T>(path, init)
