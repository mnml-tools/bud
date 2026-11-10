import { useState, useSyncExternalStore } from 'react'
import { Button } from '../atoms/Button'
import { formatShortcut } from '../../lib/shortcuts'
import {
  resolveShortcut,
  saveShortcut,
  shortcutConflict,
  getShortcuts,
  subscribeShortcuts,
  type shortcutCommands
} from '../../services/shortcutPreferences'

const macPlatform = /Mac/.test(navigator.platform)

type Props = { command: (typeof shortcutCommands)[number] }

export function ShortcutSetting({ command }: Props) {
  const overrides = useSyncExternalStore(subscribeShortcuts, getShortcuts)
  const [recording, setRecording] = useState(false)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')

  return (
    <div className="settings-shortcut-row">
      <span id={`shortcut-${command.id}`}>{command.label}</span>
      <Button
        aria-labelledby={`shortcut-${command.id}`}
        aria-pressed={recording}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true })
          setRecording(true)
          setPreview('')
          setError('')
        }}
        onBlur={() => setRecording(false)}
        onKeyDown={(event) => {
          if (!recording || event.nativeEvent.isComposing || event.repeat) return

          if (event.key === 'Tab') {
            setRecording(false)
            return
          }

          event.preventDefault()
          event.stopPropagation()
          setPreview(
            formatShortcut(
              {
                key: ['Meta', 'Control', 'Alt', 'Shift'].includes(event.key) ? '' : event.key,
                primary: macPlatform ? event.metaKey : event.ctrlKey,
                shift: event.shiftKey,
                alt: event.altKey
              },
              macPlatform
            )
          )

          if (event.key === 'Escape') {
            setRecording(false)
            setError('')
            return
          }
          if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) return

          const primary = macPlatform ? event.metaKey : event.ctrlKey

          if (!primary || (macPlatform ? event.ctrlKey : event.metaKey)) {
            setError(`Use ${macPlatform ? 'Command' : 'Ctrl'} with a key, optionally Shift or Alt.`)
            return
          }

          const shortcut = {
            ...command.shortcut,
            key: event.key.length === 1 ? event.key.toLowerCase() : event.key,
            primary,
            shift: event.shiftKey,
            alt: event.altKey
          }
          const conflict = shortcutConflict(command.id, shortcut)

          if (conflict) {
            setError(`Already used by “${conflict.label}”.`)
            return
          }

          try {
            saveShortcut(command.id, shortcut)
            setRecording(false)
            setError('')
          } catch {
            setError('Could not save this shortcut. Please try again.')
          }
        }}
      >
        {recording ? preview || 'Press shortcut…' : formatShortcut(resolveShortcut(command.shortcut))}
      </Button>
      <Button
        disabled={!overrides[command.id]}
        aria-label={`Reset ${command.label} shortcut`}
        onClick={() => {
          const conflict = shortcutConflict(command.id, command.shortcut)

          if (conflict) {
            setError(`Default is used by “${conflict.label}”. Reset all shortcuts to restore it.`)
            return
          }

          try {
            saveShortcut(command.id)
            setError('')
          } catch {
            setError('Could not reset this shortcut. Please try again.')
          }
        }}
      >
        Reset
      </Button>
      {error && (
        <p className="settings-shortcut-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
