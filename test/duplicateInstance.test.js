import test from 'node:test'
import assert from 'node:assert/strict'
import { duplicateInstance } from '../src/duplicateInstance.js'

const image = { width: 100, height: 80 }

test('duplicates an object with a visible screen-space offset', () => {
  const original = {
    id: 'original',
    x: 10,
    y: 12,
    w: 30,
    h: 24,
    keypoints: [
      { defId: 'head', x: 20, y: 18, v: 2 },
      { defId: 'hidden', x: null, y: null, v: 0 },
    ],
  }

  const duplicate = duplicateInstance(original, image, 2)

  assert.notEqual(duplicate.id, original.id)
  assert.deepEqual(duplicate, {
    ...original,
    id: duplicate.id,
    x: 20,
    y: 22,
    keypoints: [
      { defId: 'head', x: 30, y: 28, v: 2 },
      { defId: 'hidden', x: null, y: null, v: 0 },
    ],
  })
  assert.equal(original.x, 10)
  assert.equal(original.keypoints[0].x, 20)
})

test('moves the duplicate inward when the object is near the lower-right edge', () => {
  const original = {
    id: 'edge',
    x: 70,
    y: 55,
    w: 28,
    h: 23,
    keypoints: [{ defId: 'head', x: 95, y: 76, v: 2 }],
  }

  const duplicate = duplicateInstance(original, image, 1)

  assert.equal(duplicate.x, 50)
  assert.equal(duplicate.y, 35)
  assert.deepEqual(duplicate.keypoints[0], { defId: 'head', x: 75, y: 56, v: 2 })
})
