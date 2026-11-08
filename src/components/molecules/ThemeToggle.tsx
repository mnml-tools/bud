import { Palette } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../atoms/Button'
import { AppearanceDialog } from './AppearanceDialog'

export function ThemeToggle() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        className="theme-toggle"
        data-tauri-drag-region="false"
        title="Appearance"
        aria-label="Appearance"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Palette size={14} aria-hidden="true" />
      </Button>
      {open && <AppearanceDialog onDismiss={() => setOpen(false)} />}
    </>
  )
}
