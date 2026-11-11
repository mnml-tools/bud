import { LoaderCircle, Sprout } from 'lucide-react'

export function StartupLoading() {
  return (
    <main className="git-startup-loading" aria-busy="true" aria-label="Loading workspace">
      <Sprout size={32} className="git-startup-mark" aria-hidden="true" />
      <h1>Welcome back.</h1>
      <p role="status">
        <LoaderCircle size={14} className="git-spinning" aria-hidden="true" />
        Restoring your repositories…
      </p>
    </main>
  )
}
