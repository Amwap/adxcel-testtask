import { apiGet } from './client'

export type Health = { status: string }

export const getHealth = (signal?: AbortSignal) => apiGet<Health>('/health', { signal })
