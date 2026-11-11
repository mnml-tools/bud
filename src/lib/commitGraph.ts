import type { Commit } from '../types/git.ts'

export const graphColors = ['#36a269', '#4db4ac', '#579ed2', '#6388cf', '#d96868', '#dc7f9d', '#df9861', '#b7a646']

export type GraphLine = { from: number; to: number; color: number; endsAtNode?: boolean }

export type GraphRow = { lane: number; color: number; lines: GraphLine[]; width: number }

// Reserve lanes until their branch joins another line; never shift passing branches.
export function buildCommitGraph(commits: Pick<Commit, 'hash' | 'parents'>[]): GraphRow[] {
  let lanes: (string | null)[] = []

  return commits.map((commit) => {
    let lane = lanes.indexOf(commit.hash)

    if (lane < 0) {
      lane = lanes.indexOf(null)
      if (lane < 0) lane = lanes.length
      lanes[lane] = commit.hash
    }

    const before = [...lanes]
    const after = lanes.map((hash) => (hash === commit.hash ? null : hash))
    const lines: GraphLine[] = []

    before.forEach((hash, from) => {
      if (hash === null || from === lane) return

      if (hash === commit.hash) {
        lines.push({ from, to: lane, color: from % graphColors.length, endsAtNode: true })
      } else {
        lines.push({ from, to: from, color: from % graphColors.length })
      }
    })

    commit.parents.forEach((parent, index) => {
      // Each path owns its lane until the target commit is actually rendered.
      let target = index === 0 ? lane : lane + 1
      while (after[target] != null) target++
      after[target] = parent
      lines.push({ from: lane, to: target, color: target % graphColors.length })
    })

    while (after.length && after[after.length - 1] === null) after.pop()
    lanes = after

    return { lane, color: lane % graphColors.length, lines, width: Math.max(before.length, after.length) }
  })
}
