import type { ReactNode } from 'react'
import { nativeLinux } from '../../lib/platform'
import { AppHeader } from '../organisms/AppHeader'
import { AppFooter } from '../molecules/AppFooter'

type Props = {
  variant: 'app' | 'workspace'
  status: string
  onSettings: () => void
  footerLeft: ReactNode
  footerRight: ReactNode
  children: ReactNode
  dialogs?: ReactNode
}

export function AppShell({ variant, status, onSettings, footerLeft, footerRight, children, dialogs }: Props) {
  return (
    <div className={nativeLinux ? `${variant} linux-window` : variant}>
      <AppHeader status={status} onSettings={onSettings} />
      {children}
      <AppFooter left={footerLeft} right={footerRight} />
      {dialogs}
    </div>
  )
}
