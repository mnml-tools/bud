import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import type { GitWorkspace } from '../../hooks/useGitWorkspace'
import { Button } from '../atoms/Button'
import { GitDialog } from './GitDialog'

export function ActiveIdentity({ workspace, onManage }: { workspace: GitWorkspace; onManage: () => void }) {
  const [open, setOpen] = useState(false)
  const busy = !!workspace.busy
  const name = workspace.activeKey?.name ?? 'SSH config / agent'

  return (
    <>
      <Button
        className="git-footer-key"
        disabled={busy}
        title={`Active SSH identity: ${name}. Click to change.`}
        aria-label={`Active SSH identity: ${name}. Change identity`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <KeyRound size={12} />
        <span>{name}</span>
      </Button>
      {open && (
        <GitDialog title="Active SSH identity" busy={busy} onDismiss={() => setOpen(false)}>
          <label className="git-identity-picker">
            {workspace.repository ? 'Identity for this repository' : 'Default identity'}
            <select
              aria-label="Active SSH identity"
              value={workspace.activeKeyId}
              disabled={busy}
              onChange={(event) =>
                (workspace.repository ? workspace.chooseKey : workspace.changeDefaultKey)(event.target.value)
              }
            >
              <option value="">SSH config / agent</option>
              {workspace.keys.map((key) => (
                <option value={key.id} key={key.id}>
                  {key.name}
                </option>
              ))}
            </select>
          </label>
          <div className="discard-actions">
            <Button
              disabled={busy}
              onClick={() => {
                setOpen(false)
                onManage()
              }}
            >
              Manage identities
            </Button>
            <Button disabled={busy} onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </GitDialog>
      )}
    </>
  )
}
