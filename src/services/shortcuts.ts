import { createDoubleShiftDetector, matchesShortcut } from '../lib/shortcuts'
import type { Shortcut } from '../lib/shortcuts'

type Command = {
  shortcut: Shortcut
  enabled: () => boolean
  run: () => void
}

const commands = new Set<Command>()

const doubleShift = createDoubleShiftDetector()

function handleKeyboard(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || document.querySelector('dialog[open], [aria-modal="true"]')) {
    doubleShift.reset()
    return
  }

  const doubleTapped = doubleShift.handle(event)
  const inputFocused =
    event.target instanceof HTMLElement &&
    (event.target.isContentEditable || !!event.target.closest('input, textarea, select, [contenteditable]'))
  const mac = /Mac/.test(navigator.platform)
  const command = [...commands]
    .reverse()
    .find(
      (item) =>
        item.enabled() &&
        (!inputFocused || item.shortcut.allowInInputs) &&
        (item.shortcut.doubleTap
          ? doubleTapped && item.shortcut.key === 'Shift'
          : event.type === 'keydown' && matchesShortcut(event, item.shortcut, mac))
    )
  if (!command) return

  event.preventDefault()
  if (!event.repeat) command.run()
}

export function registerShortcut(command: Command) {
  if (!commands.size) {
    document.addEventListener('keydown', handleKeyboard)
    document.addEventListener('keyup', handleKeyboard)
    window.addEventListener('blur', doubleShift.reset)
  }
  commands.add(command)

  return () => {
    commands.delete(command)
    if (!commands.size) {
      document.removeEventListener('keydown', handleKeyboard)
      document.removeEventListener('keyup', handleKeyboard)
      window.removeEventListener('blur', doubleShift.reset)
      doubleShift.reset()
    }
  }
}
