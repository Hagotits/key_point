const OBJECT_DRAG_MODES = new Set(['move', 'resize', 'point'])

export function selectVisibleInstances(instances, drag) {
  if (!drag || drag.mode === 'pan') return instances
  if (drag.mode === 'draw') return []
  if (OBJECT_DRAG_MODES.has(drag.mode)) {
    return instances.filter((instance) => instance.id === drag.instId)
  }
  return instances
}
