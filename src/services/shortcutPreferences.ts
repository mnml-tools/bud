import {
  switchRepositoryShortcut,
  openRepositoryShortcut,
  cloneRepositoryShortcut,
  settingsShortcut,
  sshIdentitiesShortcut,
  refreshRepositoryShortcut,
  searchCommitsShortcut,
  selectAllFilesShortcut
} from '../lib/shortcuts.ts'
import type { Shortcut } from '../lib/shortcuts.ts'

export const shortcutCommands = [
  { id: 'switchRepository', label: 'Switch repository', shortcut: switchRepositoryShortcut },
  { id: 'openRepository', label: 'Open repository', shortcut: openRepositoryShortcut },
  { id: 'cloneRepository', label: 'Clone repository', shortcut: cloneRepositoryShortcut },
  { id: 'settings', label: 'Settings', shortcut: settingsShortcut },
  { id: 'sshIdentities', label: 'SSH identities', shortcut: sshIdentitiesShortcut },
  { id: 'refreshRepository', label: 'Refresh repository', shortcut: refreshRepositoryShortcut },
  { id: 'searchCommits', label: 'Find commits', shortcut: searchCommitsShortcut },
  { id: 'selectAllFiles', label: 'Select all changed files', shortcut: selectAllFilesShortcut }
] as const

export type ShortcutId = (typeof shortcutCommands)[number]['id']
type Overrides = Partial<Record<ShortcutId, Shortcut>>
const storageKey = 'bud.shortcuts'
const listeners = new Set<() => void>()

export function validShortcut(value: unknown): value is Shortcut {
  if (!value || typeof value !== 'object') return false
  const shortcut = value as Shortcut

  return (
    typeof shortcut.key === 'string' &&
    shortcut.key.length > 0 &&
    !['Meta', 'Control', 'Alt', 'Shift', 'Tab', 'Escape', 'Dead', 'Unidentified', 'Process'].includes(shortcut.key) &&
    shortcut.primary === true &&
    typeof shortcut.shift === 'boolean' &&
    typeof shortcut.alt === 'boolean'
  )
}

function sameShortcut(a: Shortcut, b: Shortcut) {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    !!a.primary === !!b.primary &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt
  )
}

export function readShortcutOverrides(raw: string | null): Overrides {
  try {
    const stored = JSON.parse(raw ?? '{}')
    const next: Overrides = {}
    for (const command of shortcutCommands) {
      const value = stored?.[command.id]
      if (validShortcut(value))
        next[command.id] = { ...command.shortcut, key: value.key, primary: true, shift: value.shift, alt: value.alt }
    }
    // Fall back as a set if preferences contain conflicting bindings.
    const bindings = shortcutCommands.map((command) => next[command.id] ?? command.shortcut)
    if (bindings.some((binding, index) => bindings.slice(index + 1).some((other) => sameShortcut(binding, other))))
      return {}

    return next
  } catch {
    return {}
  }
}

let overrides: Overrides = {}
try {
  overrides = readShortcutOverrides(localStorage.getItem(storageKey))
} catch {
  /* Use defaults when storage is unavailable. */
}

export const getShortcuts = () => overrides

export function subscribeShortcuts(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resolveShortcut(shortcut: Shortcut) {
  const command = shortcutCommands.find((item) => item.shortcut === shortcut)
  return (command && overrides[command.id]) || shortcut
}

export function shortcutConflict(id: ShortcutId, shortcut: Shortcut) {
  return shortcutCommands.find(
    (command) => command.id !== id && sameShortcut(resolveShortcut(command.shortcut), shortcut)
  )
}

export function saveShortcut(id: ShortcutId, shortcut?: Shortcut) {
  const command = shortcutCommands.find((item) => item.id === id)
  if (!command) throw new Error('Unknown shortcut.')
  if (shortcut && !validShortcut(shortcut))
    throw new Error('Use Command/Ctrl with a key, optionally Shift or Alt. Tab and Escape are reserved for navigation.')
  const binding = shortcut
    ? { ...command.shortcut, key: shortcut.key, primary: true, shift: !!shortcut.shift, alt: !!shortcut.alt }
    : command.shortcut
  const conflict = shortcutConflict(id, binding)
  if (conflict) throw new Error(`Already used by “${conflict.label}”.`)
  const next = { ...overrides }
  if (shortcut) next[id] = binding
  else delete next[id]
  localStorage.setItem(storageKey, JSON.stringify(next))
  overrides = next
  listeners.forEach((listener) => listener())
}

export function resetShortcuts() {
  localStorage.removeItem(storageKey)
  overrides = {}
  listeners.forEach((listener) => listener())
}
