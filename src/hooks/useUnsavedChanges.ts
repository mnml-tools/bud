import { useEffect, useRef } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

type Options = {
  hasChanges: () => boolean
  onCloseRequested: (confirmClose: () => void) => void
  onError: (error: unknown) => void
}

export function useUnsavedChanges(options: Options) {
  const latest = useRef(options)
  latest.current = options

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current.hasChanges()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', warn)
    let disposed = false
    let closeConfirmed = false
    const subscription = isTauri()
      ? getCurrentWindow().onCloseRequested((event) => {
          if (closeConfirmed || !latest.current.hasChanges()) return

          event.preventDefault()
          latest.current.onCloseRequested(() => {
            closeConfirmed = true
            getCurrentWindow()
              .close()
              .catch((error) => {
                closeConfirmed = false
                latest.current.onError(error)
              })
          })
        })
      : null
    subscription
      ?.then((unlisten) => {
        if (disposed) unlisten()
      })
      .catch((error) => latest.current.onError(error))

    return () => {
      disposed = true
      window.removeEventListener('beforeunload', warn)
      subscription?.then((unlisten) => unlisten()).catch(() => {})
    }
  }, [])
}
