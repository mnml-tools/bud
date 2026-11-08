import type { Commit } from '../types/git.ts'

export const graphColors = ['#36a269', '#a17de0', '#df9861', '#579ed2', '#dc7f9d', '#b7a646', '#5bb8b5']

type Lane = { hash: string; color: number }

export type GraphLine = { from: number; to: number; color: number }

export type GraphRow = { lane: number; color: number; lines: GraphLine[]; width: number }

// Carry pending parent identities through each row, including merges and disconnected roots.
export function buildCommitGraph(commits: Pick<Commit, 'hash' | 'parents'>[]): GraphRow[] {
  let lanes: Lane[] = []
  let nextColor = 0

  return commits.map((commit) => {
    let lane = lanes.findIndex((item) => item.hash === commit.hash)

    if (lane < 0) {
      lane = lanes.length
      lanes.push({ hash: commit.hash, color: nextColor++ % graphColors.length })
    }

    const before = lanes.map((item) => ({ ...item }))
    const color = before[lane].color
    const after = lanes.filter((_, index) => index !== lane)

    commit.parents.forEach((parent, index) => {
      if (after.some((item) => item.hash === parent)) return

      after.splice(Math.min(lane + index, after.length), 0, {
        hash: parent,
        color: index === 0 ? color : nextColor++ % graphColors.length
      })
    })

    const lines: GraphLine[] = []

    before.forEach((item, index) => {
      if (index === lane) return

      lines.push({ from: index, to: after.findIndex((next) => next.hash === item.hash), color: item.color })
    })
    commit.parents.forEach((parent) => {
      const to = after.findIndex((item) => item.hash === parent)
      lines.push({ from: lane, to, color: after[to].color })
    })
    lanes = after

    return { lane, color, lines, width: Math.max(before.length, after.length) }
  })
}
