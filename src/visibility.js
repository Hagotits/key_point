const VISIBILITY_BY_KEY = { 1: 0, 2: 1, 3: 2 }
const VISIBILITY_BY_NUMPAD_CODE = { Numpad1: 0, Numpad2: 1, Numpad3: 2 }

export function visibilityFromShortcut({ key, code }) {
  return VISIBILITY_BY_KEY[key] ?? VISIBILITY_BY_NUMPAD_CODE[code]
}

export function isNumpadVisibilityShortcut({ code }) {
  return Object.prototype.hasOwnProperty.call(VISIBILITY_BY_NUMPAD_CODE, code)
}

export function updateKeypointVisibility(annotations, imageId, instId, defId, visibility) {
  const nextInstances = (annotations[imageId] || []).map((instance) => {
    if (instance.id !== instId) return instance
    return {
      ...instance,
      keypoints: instance.keypoints.map((keypoint) => {
        if (keypoint.defId !== defId) return keypoint
        if (visibility === 0) {
          return { ...keypoint, v: 0, x: null, y: null }
        }
        if (keypoint.x == null || keypoint.y == null) {
          return {
            ...keypoint,
            v: visibility,
            x: instance.x + instance.w / 2,
            y: instance.y + instance.h / 2,
          }
        }
        return { ...keypoint, v: visibility }
      }),
    }
  })
  return { ...annotations, [imageId]: nextInstances }
}
