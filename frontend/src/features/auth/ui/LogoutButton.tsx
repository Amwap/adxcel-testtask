import { useTransition } from 'react'
import { signOut } from '@/entities/session'
import { Button } from '@/shared/ui'

export function LogoutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={() => startTransition(() => signOut())}
    >
      Sign out
    </Button>
  )
}
