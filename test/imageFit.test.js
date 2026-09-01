import test from 'node:test'
import assert from 'node:assert/strict'
import { fitImageSize } from '../src/utils.js'

test('keeps a tall image and its overlay on the same aspect ratio inside the canvas', () => {
  assert.deepEqual(
    fitImageSize(
      { width: 300, height: 900 },
      { width: 918, height: 778 }
    ),
    { width: 778 / 3, height: 778, scale: 778 / 900 }
  )
})
