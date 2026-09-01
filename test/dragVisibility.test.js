import test from 'node:test'
import assert from 'node:assert/strict'
import { selectVisibleInstances } from '../src/dragVisibility.js'

const instances = [
  { id: 'first', x: 10, y: 20, w: 30, h: 40 },
  { id: 'second', x: 50, y: 60, w: 70, h: 80 },
]

test('returns every instance while no pointer drag is active', () => {
  assert.deepEqual(selectVisibleInstances(instances, null), instances)
})

test('returns no instances while drawing a new bounding box', () => {
  assert.deepEqual(selectVisibleInstances(instances, { mode: 'draw' }), [])
})

test('returns only the active instance for object move, resize, and keypoint drag', () => {
  for (const mode of ['move', 'resize', 'point']) {
    assert.deepEqual(
      selectVisibleInstances(instances, { mode, instId: 'second' }),
      [instances[1]],
      `${mode} should keep only the active instance`
    )
  }
})

test('keeps every instance for canvas pan and non-object drag states', () => {
  assert.deepEqual(selectVisibleInstances(instances, { mode: 'pan' }), instances)
  assert.deepEqual(selectVisibleInstances(instances, { mode: 'unknown' }), instances)
})
