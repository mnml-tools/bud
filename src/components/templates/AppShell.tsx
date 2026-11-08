import type { ReactNode } from 'react'
import { nativeLinux } from '../../lib/platform'
import { AppHeader } from '../organisms/AppHeader'
import { AppFooter } from '../molecules/AppFooter'

type Props = {
  variant: 'app' | 'workspace'
  status: string
  footerLeft: ReactNode
  footerRight: ReactNode
  children: ReactNode
  dialogs?: ReactNode
}

export function AppShell({ variant, status, footerLeft, footerRight, children, dialogs }: Props) {
  return (
    <div className={nativeLinux ? `${variant} linux-window` : variant}>
      <AppHeader status={status} />
      {children}
      <AppFooter left={footerLeft} right={footerRight} />
      {dialogs}
    </div>
  )
}
