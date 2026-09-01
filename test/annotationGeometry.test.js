import test from 'node:test'
import assert from 'node:assert/strict'
import { convertLegacyInstances } from '../src/annotationGeometry.js'

test('converts tall-image legacy SVG letterbox coordinates per image', () => {
  const converted = convertLegacyInstances(
    [
      {
        id: 'tall-instance',
        x: 75,
        y: 150,
        w: 60,
        h: 180,
        keypoints: [
          { defId: 'head', x: 75, y: 150, v: 2 },
          { defId: 'tail', x: null, y: null, v: 0 },
        ],
      },
    ],
    { width: 300, height: 900 },
    { width: 300, height: 600 }
  )

  assert.deepEqual(converted, [
    {
      id: 'tall-instance',
      x: 100,
      y: 100,
      w: 40,
      h: 120,
      geometryVersion: 2,
      keypoints: [
        { defId: 'head', x: 100, y: 100, v: 2 },
        { defId: 'tail', x: null, y: null, v: 0 },
      ],
    },
  ])
})

test('keeps an unaffected aspect ratio in image coordinates', () => {
  const converted = convertLegacyInstances(
    [
      {
        id: 'wide-instance',
        x: 120,
        y: 60,
        w: 240,
        h: 120,
        keypoints: [{ defId: 'head', x: 180, y: 90, v: 2 }],
      },
    ],
    { width: 1200, height: 600 },
    { width: 1200, height: 600 }
  )

  assert.deepEqual(converted, [
    {
      id: 'wide-instance',
      x: 120,
      y: 60,
      w: 240,
      h: 120,
      geometryVersion: 2,
      keypoints: [{ defId: 'head', x: 180, y: 90, v: 2 }],
    },
  ])
})

test('accounts for width and height constraints in the legacy transform', () => {
  const converted = convertLegacyInstances(
    [
      {
        id: 'constrained-instance',
        x: 100,
        y: 200,
        w: 200,
        h: 400,
        keypoints: [{ defId: 'head', x: 300, y: 500, v: 1 }],
      },
    ],
    { width: 600, height: 1200 },
    { width: 300, height: 300 }
  )

  assert.deepEqual(converted, [
    {
      id: 'constrained-instance',
      x: 200,
      y: 100,
      w: 100,
      h: 200,
      geometryVersion: 2,
      keypoints: [{ defId: 'head', x: 300, y: 250, v: 1 }],
    },
  ])
})

test('skips instances already migrated to geometry version 2', () => {
  const instance = {
    id: 'already-current',
    x: 75,
    y: 150,
    w: 60,
    h: 180,
    geometryVersion: 2,
    keypoints: [{ defId: 'head', x: 75, y: 150, v: 2 }],
  }

  const converted = convertLegacyInstances(
    [instance],
    { width: 300, height: 900 },
    { width: 300, height: 600 }
  )

  assert.strictEqual(converted[0], instance)
})
