import { apiRequest } from './client'
import { setAccessToken, type TokenResponse } from './token'

export type User = { id: number; username: string }

export async function login(username: string, password: string) {
  const token = await apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: new URLSearchParams({ username, password }),
  })
  setAccessToken(token.access_token)
}

export async function logout() {
  try {
    await apiRequest<void>('/auth/logout', { method: 'POST' })
  } finally {
    setAccessToken(null)
  }
}

export const getMe = (signal?: AbortSignal) => apiRequest<User>('/auth/me', { signal })
