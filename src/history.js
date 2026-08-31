export const DEFAULT_HISTORY_LIMIT = 100

function cloneState(value) {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value)
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(cloneState)
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneState(entry)]))
}

function statesEqual(left, right) {
  if (Object.is(left, right)) return true
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => statesEqual(value, right[index]))
  }
  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && statesEqual(left[key], right[key])
  )
}

function validateLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('History limit must be a positive integer')
  }
  return limit
}

export function createHistory(initialState, { limit = DEFAULT_HISTORY_LIMIT } = {}) {
  const maxEntries = validateLimit(limit)
  let present = cloneState(initialState)
  let past = []
  let future = []

  const getState = () => cloneState(present)

  const commit = (nextState) => {
    const next = cloneState(nextState)
    if (statesEqual(present, next)) return false
    past.push(present)
    if (past.length > maxEntries) past.shift()
    present = next
    future = []
    return true
  }

  const undo = () => {
    if (past.length === 0) return undefined
    future.unshift(present)
    present = past.pop()
    return getState()
  }

  const redo = () => {
    if (future.length === 0) return undefined
    past.push(present)
    present = future.shift()
    return getState()
  }

  const reset = (nextState) => {
    present = cloneState(nextState)
    past = []
    future = []
    return getState()
  }

  return {
    getState,
    commit,
    undo,
    redo,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    reset,
  }
}
