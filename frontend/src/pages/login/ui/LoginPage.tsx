import { LoginForm } from '@/features/auth'
import { ThemeSwitcher } from '@/features/theme-switcher'

export function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto size-10" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Campaign analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sign in to your account
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
          Accounts are issued by an administrator.
        </p>
      </div>
    </main>
  )
}
