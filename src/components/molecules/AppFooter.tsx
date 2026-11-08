import type { ReactNode } from 'react'

export function AppFooter({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <footer>
      <span>{left}</span>
      <span>{right}</span>
    </footer>
  )
}
