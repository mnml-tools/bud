import { useSyncExternalStore } from 'react'
import { getAppearance, setAccent, setTheme, subscribeTheme } from '../services/theme'

export function useTheme() {
  const appearance = useSyncExternalStore(subscribeTheme, getAppearance)

  return { ...appearance, setTheme, setAccent }
}
