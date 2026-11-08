export type Shortcut = {
  key: string
  primary?: boolean
  shift?: boolean
  alt?: boolean
  doubleTap?: boolean
  allowInInputs?: boolean
}

export const findCommitsShortcut: Shortcut = { key: 'Shift', doubleTap: true, allowInInputs: true }

export const selectAllFilesShortcut: Shortcut = { key: 'a', primary: true }

export const cloneRepositoryShortcut: Shortcut = { key: 'n', primary: true, allowInInputs: true }

export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut, mac: boolean) {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    event.metaKey === (mac && !!shortcut.primary) &&
    event.ctrlKey === (!mac && !!shortcut.primary) &&
    event.shiftKey === !!shortcut.shift &&
    event.altKey === !!shortcut.alt
  )
}

export function formatShortcut(shortcut: Shortcut, mac = /Mac/.test(navigator.platform)) {
  const modifiers = [
    shortcut.primary ? (mac ? '⌘' : 'Ctrl') : '',
    shortcut.alt ? (mac ? '⌥' : 'Alt') : '',
    shortcut.shift ? (mac ? '⇧' : 'Shift') : ''
  ].filter(Boolean)

  const key = shortcut.key === 'Backspace' ? (mac ? '⌫' : 'Backspace') : shortcut.key.toUpperCase()

  return [...modifiers, key].join(mac ? '' : '+')
}

export function createDoubleShiftDetector() {
  let pressedAt: number | null = null
  let firstTap: number | null = null

  const reset = () => {
    pressedAt = null
    firstTap = null
  }

  const handle = (
    event: Pick<KeyboardEvent, 'type' | 'key' | 'timeStamp' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey'>
  ) => {
    if (event.key !== 'Shift' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
      reset()
      return false
    }

    if (event.type === 'keydown') {
      if (pressedAt !== null) {
        reset()
        return false
      }

      pressedAt = event.timeStamp
      return false
    }

    if (pressedAt === null || event.timeStamp - pressedAt > 300) {
      reset()
      return false
    }

    pressedAt = null
    if (firstTap !== null && event.timeStamp - firstTap <= 400) {
      reset()
      return true
    }

    firstTap = event.timeStamp
    return false
  }

  return { handle, reset }
}
