import { nativeLinux, nativeMac } from '../../lib/platform'
import { BrandMark } from '../molecules/BrandMark'
import { Settings } from 'lucide-react'
import { Button } from '../atoms/Button'
import { StatusDot } from '../atoms/StatusDot'
import { WindowControls } from '../molecules/WindowControls'

export function AppHeader({ status, onSettings }: { status: string; onSettings: () => void }) {
  return (
    <header data-tauri-drag-region className={nativeMac ? 'native-titlebar' : undefined}>
      <BrandMark />
      <div className="header-right">
        <Button
          type="button"
          className="settings-trigger"
          title="Settings"
          aria-label="Settings"
          aria-haspopup="dialog"
          data-tauri-drag-region="false"
          onClick={onSettings}
        >
          <Settings size={15} />
        </Button>
        <StatusDot />
        {status}
        {nativeLinux && <WindowControls />}
      </div>
    </header>
  )
}
