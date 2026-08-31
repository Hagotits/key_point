import test from 'node:test'
import assert from 'node:assert/strict'
import { createHistory } from '../src/history.js'

test('starts at the initial snapshot and exposes empty undo/redo state', () => {
  const history = createHistory({ annotations: [] })

  assert.deepEqual(history.getState(), { annotations: [] })
  assert.equal(history.canUndo(), false)
  assert.equal(history.canRedo(), false)
  assert.equal(history.undo(), undefined)
  assert.equal(history.redo(), undefined)
})

test('commits one logical edit, ignores no-ops, and protects snapshots', () => {
  const history = createHistory({ annotations: [] })
  const next = { annotations: [{ id: 'one' }] }

  assert.equal(history.commit(next), true)
  next.annotations.push({ id: 'mutated-after-commit' })
  assert.deepEqual(history.getState(), { annotations: [{ id: 'one' }] })

  assert.equal(history.commit({ annotations: [{ id: 'one' }] }), false)
  assert.equal(history.canUndo(), true)
})

test('undoes and redoes edits, clearing redo after a new commit', () => {
  const history = createHistory('initial')

  history.commit('first')
  history.commit('second')
  assert.equal(history.undo(), 'first')
  assert.equal(history.canRedo(), true)
  assert.equal(history.redo(), 'second')

  history.undo()
  history.commit('replacement')
  assert.equal(history.canRedo(), false)
  assert.equal(history.getState(), 'replacement')
})

test('keeps only the configured number of undoable snapshots', () => {
  const history = createHistory(0, { limit: 2 })

  history.commit(1)
  history.commit(2)
  history.commit(3)

  assert.equal(history.undo(), 2)
  assert.equal(history.undo(), 1)
  assert.equal(history.undo(), undefined)
})

test('reset establishes a new baseline and clears both directions', () => {
  const history = createHistory('initial')

  history.commit('edited')
  assert.equal(history.reset('loaded'), 'loaded')
  assert.equal(history.getState(), 'loaded')
  assert.equal(history.canUndo(), false)
  assert.equal(history.canRedo(), false)
})
