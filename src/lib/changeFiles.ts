import type { Repository } from '../types/git'

export type ChangedFile = NonNullable<Repository['changes']>[number]
export type ChangeRow =
  { kind: 'folder'; path: string; depth: number } | { kind: 'file'; path: string; depth: number; file: ChangedFile }

export function changeRows(files: ChangedFile[], tree: boolean, collapsed: Set<string>): ChangeRow[] {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
  if (!tree) return sorted.map((file) => ({ kind: 'file', path: file.path, depth: 0, file }))

  const folders = new Set<string>()
  for (const file of files) {
    const parts = file.path.split('/')
    for (let depth = 1; depth < parts.length; depth++) folders.add(parts.slice(0, depth).join('/'))
  }
  const rows: ChangeRow[] = []
  const visit = (parent: string, depth: number) => {
    const prefix = parent ? `${parent}/` : ''
    const direct = (path: string) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/')
    for (const path of [...folders].filter(direct).sort()) {
      rows.push({ kind: 'folder', path, depth })
      if (!collapsed.has(path)) visit(path, depth + 1)
    }
    for (const file of sorted.filter((file) => direct(file.path)))
      rows.push({ kind: 'file', path: file.path, depth, file })
  }
  visit('', 0)
  return rows
}

export function changeStatus(file: ChangedFile, staged: boolean) {
  return file.status === '??' ? 'A' : file.status[staged ? 0 : 1]
}

export function changeColor(status: string) {
  return status === 'A' || status === '?' ? 'added' : status === 'D' ? 'removed' : 'modified'
}
