import { useEffect, useState } from 'react'
import { useGitWorkspace } from '../hooks/useGitWorkspace'
import { useShortcut } from '../hooks/useShortcut'
import {
  cloneRepositoryShortcut,
  switchRepositoryShortcut,
  openRepositoryShortcut,
  settingsShortcut,
  sshIdentitiesShortcut
} from '../lib/shortcuts'
import { RepositorySwitcher } from '../components/organisms/RepositorySwitcher'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { GitDialog } from '../components/molecules/GitDialog'
import { GitErrorDialog } from '../components/molecules/GitErrorDialog'
import { useAppUpdate } from '../hooks/useAppUpdate'
import { registerUpdateGuard } from '../services/updateGuard'
import { UpdateDialog } from '../components/organisms/UpdateDialog'
import { gitRequest } from '../services/git'
import type { GitRequest } from '../services/git'
import { AppShell } from '../components/templates/AppShell'
import { Button } from '../components/atoms/Button'
import { RepositoryDialog } from '../components/organisms/RepositoryDialog'
import { RepositoryList } from '../components/organisms/RepositoryList'
import { CloneRepositoryDialog } from '../components/organisms/CloneRepositoryDialog'
import { SettingsDialog, type SettingsSection } from '../components/organisms/SettingsDialog'
import { GitWorkspacePage } from '../pages/GitWorkspacePage'
import { NoticeToast } from '../components/molecules/NoticeToast'
import { ActiveIdentity } from '../components/molecules/ActiveIdentity'
import { RepositoryTabs } from '../components/organisms/RepositoryTabs'

export function App({ request = gitRequest }: { request?: GitRequest }) {
  const workspace = useGitWorkspace(request)
  const { update, dismiss, setUpdate } = useAppUpdate()
  const [dialog, setDialog] = useState<'open' | 'clone' | 'settings' | 'switch' | null>(null)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('themes')
  const [closeBlocked, setCloseBlocked] = useState(false)
  const busy = !!workspace.busy
  const repo = workspace.repository

  const openSettings = (section: SettingsSection = 'themes') => {
    setSettingsSection(section)
    setDialog('settings')
  }

  useUnsavedChanges({
    hasChanges: () => busy,
    onCloseRequested: () => setCloseBlocked(true),
    onError: (error) => console.error('Unable to protect Git operation:', error)
  })

  useEffect(() => {
    if (!busy) setCloseBlocked(false)
  }, [busy])

  useEffect(() => registerUpdateGuard(() => ({ dirty: false, busy })), [busy])

  useShortcut(openRepositoryShortcut, !busy, () => {
    workspace.clearError()
    setDialog('open')
  })
  useShortcut(cloneRepositoryShortcut, !busy, () => {
    workspace.clearError()
    setDialog('clone')
  })
  useShortcut(sshIdentitiesShortcut, !busy, () => openSettings('ssh'))
  useShortcut(switchRepositoryShortcut, !busy, () => setDialog('switch'))

  useShortcut(settingsShortcut, !busy, () => openSettings())

  return (
    <AppShell
      variant={repo ? 'workspace' : 'app'}
      onSettings={() => openSettings()}
      status={busy ? workspace.busy : 'Local workspace'}
      footerLeft={
        <>
          {repo
            ? `${repo.currentBranch} · ${repo.dirty ? 'Uncommitted changes' : 'Working tree clean'}`
            : 'Open a repository to get started'}
          {busy && ` · ${workspace.busy}…`}
        </>
      }
      footerRight={
        <>
          <ActiveIdentity workspace={workspace} onManage={() => openSettings('ssh')} />
          <span>Bud 0.1.0</span>
        </>
      }
      dialogs={
        <>
          {dialog === 'switch' && <RepositorySwitcher workspace={workspace} onDismiss={() => setDialog(null)} />}
          {dialog === 'open' && (
            <RepositoryDialog workspace={workspace} request={request} onDismiss={() => setDialog(null)} />
          )}
          {dialog === 'clone' && (
            <CloneRepositoryDialog workspace={workspace} request={request} onDismiss={() => setDialog(null)} />
          )}
          {closeBlocked && (
            <GitDialog title="Git is still running" onDismiss={() => setCloseBlocked(false)}>
              <p>Wait for {workspace.busy.toLowerCase()} to finish before closing Bud.</p>
              <div className="discard-actions">
                <Button onClick={() => setCloseBlocked(false)}>Got it</Button>
              </div>
            </GitDialog>
          )}
          {update && !dialog && !workspace.error && <UpdateDialog update={update} onDismiss={dismiss} />}
          {dialog === 'settings' && (
            <SettingsDialog
              workspace={workspace}
              initialSection={settingsSection}
              onDismiss={() => setDialog(null)}
              onUpdate={(next) => {
                setUpdate(next)
                setDialog(null)
              }}
            />
          )}
          {workspace.error && <GitErrorDialog message={workspace.error} onDismiss={workspace.clearError} />}
        </>
      }
    >
      {workspace.openedRepositories.length > 0 && <RepositoryTabs workspace={workspace} />}
      {workspace.notice && <NoticeToast key={`${repo?.path}:${workspace.notice}`} message={workspace.notice} />}
      {repo ? (
        <GitWorkspacePage
          key={repo.path}
          workspace={workspace}
          onOpenAiSettings={() => openSettings('ai')}
          onClone={() => {
            workspace.clearError()
            setDialog('clone')
          }}
        />
      ) : (
        <RepositoryList
          workspace={workspace}
          onOpen={() => {
            workspace.clearError()
            setDialog('open')
          }}
          onClone={() => {
            workspace.clearError()
            setDialog('clone')
          }}
        />
      )}
    </AppShell>
  )
}
