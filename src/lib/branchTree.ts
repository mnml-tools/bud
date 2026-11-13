import type { Branch } from '../types/git'

export type BranchRow =
  | { kind: 'folder'; path: string; label: string; depth: number }
  | { kind: 'branch'; path: string; label: string; depth: number; branch: Branch }

export function branchRows(branches: Branch[], collapsed: Set<string>, query = ''): BranchRow[] {
  type Folder = { folders: Map<string, Folder>; branches: Branch[] }

  const root: Folder = { folders: new Map(), branches: [] }
  const search = query.toLowerCase()

  for (const branch of branches) {
    if (!branch.name.toLowerCase().includes(search)) continue

    const parts = branch.name.split('/')
    let folder = root
    for (const part of parts.slice(0, -1)) {
      if (!folder.folders.has(part)) folder.folders.set(part, { folders: new Map(), branches: [] })
      folder = folder.folders.get(part)!
    }
    folder.branches.push(branch)
  }

  const rows: BranchRow[] = []
  const visit = (folder: Folder, parent: string, depth: number) => {
    const leaves = [...folder.branches].sort((a, b) => a.name.localeCompare(b.name))
    const addBranch = (branch: Branch) =>
      rows.push({ kind: 'branch', path: branch.name, label: branch.name.split('/').at(-1)!, depth, branch })

    if (!parent) leaves.filter((branch) => branch.name === 'main').forEach(addBranch)

    for (const [label, child] of [...folder.folders].sort(([a], [b]) => a.localeCompare(b))) {
      const path = parent ? `${parent}/${label}` : label
      rows.push({ kind: 'folder', path, label, depth })
      if (search || !collapsed.has(path)) visit(child, path, depth + 1)
    }

    leaves.filter((branch) => parent || branch.name !== 'main').forEach(addBranch)
  }

  visit(root, '', 0)
  return rows
}
