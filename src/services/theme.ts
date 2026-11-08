import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export const modes = ['light', 'dark'] as const

export const accents = ['pink', 'blue', 'orange', 'green', 'purple'] as const

export type Theme = (typeof modes)[number]

export type Accent = (typeof accents)[number]

const themeKey = 'bud.theme'
const accentKey = 'bud.accent'
const listeners = new Set<() => void>()

function readPreference<T extends string>(key: string, options: readonly T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return options.find((option) => option === stored) ?? fallback
  } catch {
    return fallback
  }
}

function readAppearance() {
  return {
    theme: readPreference(themeKey, modes, 'light'),
    accent: readPreference(accentKey, accents, 'green')
  }
}

let current = readAppearance()

function applyMode() {
  document.documentElement.dataset.theme = current.theme

  if (isTauri())
    getCurrentWindow()
      .setTheme(current.theme)
      .catch((error) => console.error('Unable to update native window theme:', error))
}

function applyAccent() {
  document.documentElement.dataset.accent = current.accent
}

function notify() {
  listeners.forEach((listener) => listener())
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Keep the current session usable if storage is unavailable. */
  }
}

applyMode()
applyAccent()

export const getAppearance = () => current

export function subscribeTheme(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function setTheme(theme: Theme) {
  current = { ...current, theme }
  applyMode()
  persist(themeKey, theme)
  notify()
}

export function setAccent(accent: Accent) {
  current = { ...current, accent }
  applyAccent()
  persist(accentKey, accent)
  notify()
}

window.addEventListener('storage', (event) => {
  if (event.key === themeKey || event.key === accentKey || event.key === null) {
    current = readAppearance()
    applyMode()
    applyAccent()
    notify()
  }
})
