import { uid } from './utils.js'

const DUPLICATE_OFFSET_PX = 20

export function duplicateInstance(instance, image, scale) {
  const placedKeypoints = instance.keypoints.filter(
    (keypoint) => Number.isFinite(keypoint.x) && Number.isFinite(keypoint.y)
  )
  const desiredOffset = DUPLICATE_OFFSET_PX / scale

  const offsetWithin = (min, max, limit) => {
    const forwardRoom = limit - max
    if (forwardRoom >= desiredOffset) return desiredOffset
    if (min >= desiredOffset) return -desiredOffset
    return forwardRoom >= min ? Math.max(0, forwardRoom) : -Math.max(0, min)
  }

  const dx = offsetWithin(
    Math.min(instance.x, ...placedKeypoints.map((keypoint) => keypoint.x)),
    Math.max(instance.x + instance.w, ...placedKeypoints.map((keypoint) => keypoint.x)),
    image.width
  )
  const dy = offsetWithin(
    Math.min(instance.y, ...placedKeypoints.map((keypoint) => keypoint.y)),
    Math.max(instance.y + instance.h, ...placedKeypoints.map((keypoint) => keypoint.y)),
    image.height
  )

  return {
    ...instance,
    id: uid(),
    x: instance.x + dx,
    y: instance.y + dy,
    keypoints: instance.keypoints.map((keypoint) =>
      keypoint.x == null || keypoint.y == null
        ? { ...keypoint }
        : { ...keypoint, x: keypoint.x + dx, y: keypoint.y + dy }
    ),
  }
}
