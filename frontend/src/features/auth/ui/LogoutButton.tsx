import { useTransition } from 'react'
import { signOut } from '@/entities/session'
import { Spinner } from '@/shared/ui'

/** A quiet icon button: it sits next to the user's name, so the label lives in the tooltip. */
export function LogoutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      title="Sign out"
      aria-label="Sign out"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
      className="shrink-0 cursor-pointer rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {pending ? (
        <Spinner className="size-5" />
      ) : (
        <svg
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
        </svg>
      )}
    </button>
  )
}
