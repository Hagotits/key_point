import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAnnotationPointerAction } from '../src/pointerInteraction.js'

test('routes Shift+drag over an existing annotation to new bbox creation', () => {
  assert.equal(
    resolveAnnotationPointerAction({ button: 0, shiftKey: true, spacePan: false }),
    'draw'
  )
})

test('keeps normal annotation drag in edit mode', () => {
  assert.equal(
    resolveAnnotationPointerAction({ button: 0, shiftKey: false, spacePan: false }),
    'edit'
  )
})

test('keeps Space+drag and middle-button drag routed to pan', () => {
  assert.equal(
    resolveAnnotationPointerAction({ button: 0, shiftKey: true, spacePan: true }),
    'pan'
  )
  assert.equal(
    resolveAnnotationPointerAction({ button: 1, shiftKey: true, spacePan: false }),
    'pan'
  )
})
