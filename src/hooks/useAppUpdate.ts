import { useEffect, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { check, type Update } from '@tauri-apps/plugin-updater'

export function useAppUpdate() {
  const [update, setUpdate] = useState<Update | null>(null)

  useEffect(() => {
    if (!isTauri() || import.meta.env.DEV) return

    let disposed = false
    let pending: Update | null = null
    void check({ timeout: 15000 })
      .then((result) => {
        pending = result
        if (disposed) void result?.close().catch(() => {})
        else setUpdate(result)
      })
      .catch((error) => console.warn('Startup update check failed:', error))

    return () => {
      disposed = true
      void pending?.close().catch(() => {})
    }
  }, [])

  const dismiss = () => {
    void update?.close().catch(() => {})
    setUpdate(null)
  }

  return { update, dismiss, setUpdate }
}
