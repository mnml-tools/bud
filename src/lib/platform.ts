import { isTauri } from '@tauri-apps/api/core'

export const nativeMac = isTauri() && /Mac/.test(navigator.platform)

export const linuxPlatform = /Linux/.test(navigator.platform)

export const nativeLinux = isTauri() && linuxPlatform

// Browsers report macOS as "MacIntel" even on Apple silicon; Cmd is the link modifier there.
export const macPlatform = /Mac/.test(navigator.platform)
