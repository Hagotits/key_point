export function resolveAnnotationPointerAction({ button, shiftKey, spacePan }) {
  if (button === 1 || (button === 0 && spacePan)) return 'pan'
  if (button !== 0) return 'ignore'
  if (shiftKey) return 'draw'
  return 'edit'
}
