import { useEffect, useRef, useState } from 'react'
import type { Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { inspectUpdateSafety, updateDecision } from '../../services/updateGuard'
import { gitRequest } from '../../services/git'
import { Button } from '../atoms/Button'

export function UpdateDialog({ update, onDismiss }: { update: Update; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const installing = useRef(false)
  const installed = useRef(false)
  const [phase, setPhase] = useState<'ready' | 'confirm' | 'installing' | 'installed'>('ready')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('Starting download…')
  const [percent, setPercent] = useState<number | undefined>()

  useEffect(() => {
    const element = dialog.current!
    element.showModal()

    return () => element.close()
  }, [])

  const install = async () => {
    if (installing.current) return

    const decision = updateDecision(inspectUpdateSafety(), phase === 'confirm', installed.current)

    if (decision === 'busy') {
      setError('Wait for Git operations to finish before updating.')
      return
    }
    if (decision === 'confirm') {
      setPhase('confirm')
      return
    }

    installing.current = true
    setError('')
    setProgress('Starting download…')
    setPercent(undefined)
    setPhase('installing')

    try {
      if (!installed.current) {
        let received = 0
        let total: number | undefined
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') {
            total = event.data.contentLength
            if (total) setPercent(0)
          }
          if (event.event === 'Progress') {
            received += event.data.chunkLength
            if (total) {
              const next = Math.min(100, Math.round((received / total) * 100))
              setPercent(next)
              setProgress(`${next}%`)
            } else {
              setProgress(`${Math.round(received / 1024)} KB downloaded`)
            }
          }
          if (event.event === 'Finished') {
            setPercent(100)
            setProgress('Installing…')
          }
        })
        installed.current = true
      }
      setPhase('installed')
      await relaunch()
    } catch (error) {
      setError(String(error))
      setPhase(installed.current ? 'installed' : 'ready')
      installing.current = false
    }
  }

  return (
    <dialog
      ref={dialog}
      className="modal error-dialog update-dialog"
      aria-labelledby="update-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!installing.current) onDismiss()
      }}
    >
      <div className="modal-heading">
        <h2 id="update-title">Bud {update.version} is available</h2>
      </div>
      <p>
        {phase === 'confirm'
          ? 'Unsaved changes will be discarded. Cancel to save your work first, or discard changes and update.'
          : phase === 'installed'
            ? 'The update is installed. Restart Bud to finish.'
            : phase === 'installing'
              ? 'Updating Bud…'
              : 'Install the update and restart Bud.'}
      </p>
      {phase === 'installing' && (
        <div className="update-progress">
          <progress aria-label="Update download progress" max={100} value={percent} />
          <span aria-live="polite">{progress}</span>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="discard-actions update-actions">
        <a
          className="update-release-notes"
          href="https://github.com/mnml-tools/bud/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            event.preventDefault()
            void gitRequest('open_latest_release').catch((error) => setError(String(error)))
          }}
        >
          What’s new
        </a>
        <Button disabled={phase === 'installing'} onClick={onDismiss}>
          {phase === 'confirm' ? 'Cancel' : 'Later'}
        </Button>
        <Button className="primary" disabled={phase === 'installing'} onClick={() => void install()}>
          {phase === 'confirm'
            ? 'Discard changes and update'
            : phase === 'installed'
              ? 'Restart Bud'
              : 'Install and restart'}
        </Button>
      </div>
    </dialog>
  )
}
