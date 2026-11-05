import { useActionState } from 'react'
import { signIn } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { Button, Input } from '@/shared/ui'

type FormState = { username: string; error: string | null }

async function submit(_prev: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get('username') ?? '')
  const password = String(form.get('password') ?? '')
  try {
    await signIn(username, password)
    return { username, error: null }
  } catch (e) {
    const error =
      e instanceof ApiError && e.status === 401
        ? 'Incorrect username or password.'
        : 'Could not sign in. Please try again later.'
    return { username, error }
  }
}

export function LoginForm() {
  const [state, action, pending] = useActionState(submit, { username: '', error: null })

  return (
    <form action={action} className="space-y-5">
      <Input
        label="Username"
        name="username"
        autoComplete="username"
        autoFocus
        required
        defaultValue={state.username}
        aria-invalid={state.error ? true : undefined}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={state.error ? true : undefined}
      />

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" loading={pending} className="w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
