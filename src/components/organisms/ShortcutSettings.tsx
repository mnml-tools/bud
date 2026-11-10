import { useState } from 'react'
import { Button } from '../atoms/Button'
import { ShortcutSetting } from '../molecules/ShortcutSetting'
import { resetShortcuts, shortcutCommands } from '../../services/shortcutPreferences'

export function ShortcutSettings() {
  const [error, setError] = useState('')

  return (
    <section className="settings-section">
      <div>
        <h2>Shortcuts</h2>
        <p>Click a shortcut, then press a new combination. Press Escape to cancel.</p>
      </div>
      <div>
        {shortcutCommands.map((command) => (
          <ShortcutSetting key={command.id} command={command} />
        ))}
      </div>
      <p className="git-hint">
        Use Command on macOS or Ctrl on Windows/Linux, optionally with Shift or Alt. Tab and Escape keep their
        navigation behaviour. Double Shift remains available to find commits.
      </p>
      <div>
        <Button
          onClick={() => {
            try {
              resetShortcuts()
              setError('')
            } catch {
              setError('Could not reset shortcuts. Please try again.')
            }
          }}
        >
          Reset all shortcuts
        </Button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  )
}
