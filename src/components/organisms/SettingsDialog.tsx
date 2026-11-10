import { useState } from 'react'
import { Palette, KeyRound, Sparkles, Keyboard, Info } from 'lucide-react'
import type { Update } from '@tauri-apps/plugin-updater'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { GitDialog } from '../molecules/GitDialog'
import { Button } from '../atoms/Button'
import { ThemeSettings } from './ThemeSettings'
import { SshIdentitySettings } from './SshIdentitySettings'
import { AiSettings } from './AiSettings'
import { ShortcutSettings } from './ShortcutSettings'
import { UpdateSettings } from './UpdateSettings'

export type SettingsSection = 'themes' | 'ssh' | 'ai' | 'shortcuts' | 'updates'

const sections = [
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'ssh', label: 'SSH identities', icon: KeyRound },
  { id: 'ai', label: 'AI commit messages', icon: Sparkles },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'updates', label: 'Updates & about', icon: Info }
] as const

export function SettingsDialog({
  workspace,
  initialSection = 'themes',
  onDismiss,
  onUpdate
}: {
  workspace: GitWorkspace
  initialSection?: SettingsSection
  onDismiss: () => void
  onUpdate: (update: Update) => void
}) {
  const [section, setSection] = useState<SettingsSection>(initialSection)
  const [busy, setBusy] = useState(false)
  const [visited, setVisited] = useState<Set<SettingsSection>>(() => new Set([initialSection]))

  return (
    <GitDialog title="Settings" className="settings-dialog" busy={busy} onDismiss={onDismiss}>
      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="Settings sections">
          {sections.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              disabled={busy}
              aria-current={section === id ? 'page' : undefined}
              onClick={() => {
                setSection(id)
                setVisited((previous) => new Set([...previous, id]))
              }}
            >
              <Icon size={15} />
              {label}
            </Button>
          ))}
        </nav>
        <div className="settings-content">
          {sections.map(({ id }) => (
            <div key={id} hidden={section !== id}>
              {visited.has(id) &&
                (id === 'themes' ? (
                  <ThemeSettings />
                ) : id === 'ssh' ? (
                  <SshIdentitySettings workspace={workspace} request={workspace.request} onBusyChange={setBusy} />
                ) : id === 'ai' ? (
                  <AiSettings request={workspace.request} onBusyChange={setBusy} />
                ) : id === 'shortcuts' ? (
                  <ShortcutSettings />
                ) : (
                  <UpdateSettings request={workspace.request} onUpdate={onUpdate} />
                ))}
            </div>
          ))}
        </div>
        <div className="discard-actions settings-actions">
          <Button disabled={busy} onClick={onDismiss}>
            Done
          </Button>
        </div>
      </div>
    </GitDialog>
  )
}
