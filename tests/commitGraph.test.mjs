import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCommitGraph } from '../src/lib/commitGraph.ts'

const commit = (hash, ...parents) => ({ hash, parents })

test('linear history stays in one lane and ends at its root', () => {
  const graph = buildCommitGraph([commit('c', 'b'), commit('b', 'a'), commit('a')])
  assert.deepEqual(
    graph.map((row) => row.lane),
    [0, 0, 0]
  )
  assert.deepEqual(
    graph.map((row) => row.lines.length),
    [1, 1, 0]
  )
  assert.equal(graph[0].color, graph[2].color)
})

test('merges split into distinct colors then converge on the shared parent', () => {
  const graph = buildCommitGraph([
    commit('merge', 'main', 'feature'),
    commit('feature', 'base'),
    commit('main', 'base'),
    commit('base')
  ])
  assert.equal(graph[0].lines.length, 2)
  assert.notEqual(graph[0].lines[0].color, graph[0].lines[1].color)
  assert.equal(graph[1].lane, 1)
  assert.equal(graph[2].lane, 0)
  assert.equal(graph[2].lines.filter((line) => line.to === 0).length, 2)
  assert.equal(graph[3].lane, 0)
  assert.deepEqual(graph[3].lines, [])
})

test('octopus merges, disconnected roots and page boundaries have valid lanes', () => {
  const commits = [
    commit('m', 'a', 'b', 'c'),
    commit('other'),
    commit('a', 'root'),
    commit('b', 'root'),
    commit('c', 'root'),
    commit('root')
  ]
  const full = buildCommitGraph(commits)
  const firstPage = buildCommitGraph(commits.slice(0, 3))
  assert.deepEqual(firstPage, full.slice(0, 3))
  assert.equal(full[0].lines.length, 3)
  assert.deepEqual(full.at(-1).lines, [])
  for (const row of full) {
    for (const line of row.lines) {
      assert.ok(line.from >= 0 && line.from < row.width)
      assert.ok(line.to >= 0 && line.to < row.width)
    }
  }
})
