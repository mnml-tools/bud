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
  assert.equal(graph[2].lines.find((line) => line.from === 1).to, 1)
  assert.equal(graph[3].lane, 0)
  assert.equal(graph[3].lines[0].endsAtNode, true)
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
  assert.ok(full.at(-1).lines.every((line) => line.endsAtNode))
  for (const row of full) {
    for (const line of row.lines) {
      assert.ok(line.from >= 0 && line.from < row.width)
      assert.ok(line.to >= 0 && line.to < row.width)
    }
  }
})

test('reused lanes keep their color and the main lane returns to green after a merge', () => {
  const graph = buildCommitGraph([
    commit('merge2', 'main2', 'feature2'),
    commit('feature2', 'main2'),
    commit('main2', 'merge1'),
    commit('merge1', 'main1', 'feature1'),
    commit('feature1', 'base'),
    commit('main1', 'base'),
    commit('base')
  ])
  assert.equal(graph[1].color, 1)
  assert.equal(graph[4].color, 1)
  assert.equal(graph.at(-1).color, 0)
  for (const row of graph) {
    assert.equal(row.color, row.lane)
    for (const line of row.lines) {
      assert.equal(line.color, Math.max(line.from, line.to))
      assert.ok(line.color < 2)
    }
  }
})

test('active branches stay in their lanes as new branches open and close', () => {
  const graph = buildCommitGraph([
    commit('top', 'main', 'side'),
    commit('main', 'base', 'feature'),
    commit('feature', 'base'),
    commit('side', 'base'),
    commit('base')
  ])
  assert.equal(graph[0].lines.find((line) => line.to === 1).color, 1)
  assert.equal(graph[1].lines.find((line) => line.from === 1).to, 1)
  assert.equal(graph[1].lines.find((line) => line.to === 2).color, 2)
  assert.equal(graph[2].lane, 2)
  assert.equal(graph[2].color, 2)
  assert.equal(graph[2].lines.find((line) => line.from === 1).to, 1)
  assert.equal(graph[3].lane, 1)
  assert.equal(graph[4].lane, 0)
})

test('shared ancestors do not join paths before the ancestor commit', () => {
  const graph = buildCommitGraph([
    commit('merge2', 'merge1', 'feature2'),
    commit('feature2', 'base'),
    commit('merge1', 'base', 'feature1'),
    commit('feature1', 'base'),
    commit('base')
  ])
  assert.equal(graph[2].lines.find((line) => line.from === 1).to, 1)
  assert.equal(graph[2].lines.find((line) => line.from === 0 && line.to === 2).color, 2)
  assert.equal(graph[3].lane, 2)
  assert.equal(graph[3].lines.find((line) => line.from === 2).to, 2)
  assert.equal(graph[4].lane, 0)
  assert.deepEqual(
    graph[4].lines.map((line) => [line.from, line.to, line.endsAtNode]),
    [
      [1, 0, true],
      [2, 0, true]
    ]
  )
})
