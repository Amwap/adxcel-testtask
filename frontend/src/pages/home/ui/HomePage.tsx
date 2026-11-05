import { useHealth } from '../model/useHealth'

export function HomePage() {
  const status = useHealth()

  return (
    <main>
      <h1>Campaign analytics</h1>
      <p>
        Backend: <code>{status}</code>
      </p>
    </main>
  )
}
