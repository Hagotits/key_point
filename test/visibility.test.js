import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isNumpadVisibilityShortcut,
  updateKeypointVisibility,
  visibilityFromShortcut,
} from '../src/visibility.js'

test('maps the top-row visibility shortcuts', () => {
  assert.equal(visibilityFromShortcut({ key: '1', code: 'Digit1' }), 0)
  assert.equal(visibilityFromShortcut({ key: '2', code: 'Digit2' }), 1)
  assert.equal(visibilityFromShortcut({ key: '3', code: 'Digit3' }), 2)
})

test('maps physical numpad shortcuts with Num Lock on or off', () => {
  assert.equal(visibilityFromShortcut({ key: '1', code: 'Numpad1' }), 0)
  assert.equal(visibilityFromShortcut({ key: 'End', code: 'Numpad1' }), 0)
  assert.equal(visibilityFromShortcut({ key: 'ArrowDown', code: 'Numpad2' }), 1)
  assert.equal(visibilityFromShortcut({ key: 'PageDown', code: 'Numpad3' }), 2)
})

test('ignores unrelated keys', () => {
  assert.equal(visibilityFromShortcut({ key: '4', code: 'Digit4' }), undefined)
  assert.equal(visibilityFromShortcut({ key: 'End', code: 'End' }), undefined)
})

test('identifies physical numpad shortcuts so inspector radio navigation ignores them', () => {
  assert.equal(isNumpadVisibilityShortcut({ code: 'Numpad1' }), true)
  assert.equal(isNumpadVisibilityShortcut({ code: 'Numpad2' }), true)
  assert.equal(isNumpadVisibilityShortcut({ code: 'Numpad3' }), true)
  assert.equal(isNumpadVisibilityShortcut({ code: 'Digit1' }), false)
  assert.equal(isNumpadVisibilityShortcut({ code: 'End' }), false)
})

test('updates visibility without mutating the current annotation snapshot', () => {
  const current = {
    image: [
      {
        id: 'instance',
        x: 10,
        y: 20,
        w: 40,
        h: 60,
        keypoints: [{ defId: 'head', x: 12, y: 24, v: 2 }],
      },
    ],
  }

  const next = updateKeypointVisibility(current, 'image', 'instance', 'head', 0)

  assert.deepEqual(next.image[0].keypoints[0], { defId: 'head', x: null, y: null, v: 0 })
  assert.deepEqual(current.image[0].keypoints[0], { defId: 'head', x: 12, y: 24, v: 2 })
})

test('restores a missing keypoint at the object center', () => {
  const current = {
    image: [
      {
        id: 'instance',
        x: 10,
        y: 20,
        w: 40,
        h: 60,
        keypoints: [{ defId: 'head', x: null, y: null, v: 0 }],
      },
    ],
  }

  const next = updateKeypointVisibility(current, 'image', 'instance', 'head', 1)

  assert.deepEqual(next.image[0].keypoints[0], { defId: 'head', x: 30, y: 50, v: 1 })
})
