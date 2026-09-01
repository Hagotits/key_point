export const ANNOTATION_GEOMETRY_VERSION = 2

// The old SVG kept the width-fit image scale while its height was constrained,
// so the viewBox could have a horizontal xMidYMid meet letterbox.
export function getLegacySvgTransform(image, bounds) {
  const oldImageScale = Math.min(1, bounds.width / image.width)
  const oldViewportWidth = image.width * oldImageScale
  const oldViewportHeight = Math.min(image.height * oldImageScale, bounds.height)
  const svgScale = Math.min(
    oldViewportWidth / image.width,
    oldViewportHeight / image.height
  )
  const renderedWidth = image.width * svgScale
  const renderedHeight = image.height * svgScale
  return {
    oldImageScale,
    svgScale,
    offsetX: (oldViewportWidth - renderedWidth) / 2,
    offsetY: (oldViewportHeight - renderedHeight) / 2,
  }
}

export function convertLegacyInstances(instances, image, bounds) {
  const transform = getLegacySvgTransform(image, bounds)
  const factor = transform.svgScale / transform.oldImageScale
  const biasX = transform.offsetX / transform.oldImageScale
  const biasY = transform.offsetY / transform.oldImageScale

  return instances.map((instance) => {
    if (instance.geometryVersion === ANNOTATION_GEOMETRY_VERSION) return instance

    const converted = {
      ...instance,
      x: biasX + instance.x * factor,
      y: biasY + instance.y * factor,
      w: instance.w * factor,
      h: instance.h * factor,
      geometryVersion: ANNOTATION_GEOMETRY_VERSION,
    }

    if (Array.isArray(instance.keypoints)) {
      converted.keypoints = instance.keypoints.map((keypoint) => {
        if (keypoint.x == null || keypoint.y == null) return { ...keypoint }
        return {
          ...keypoint,
          x: biasX + keypoint.x * factor,
          y: biasY + keypoint.y * factor,
        }
      })
    }

    return converted
  })
}
