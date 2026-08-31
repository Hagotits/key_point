import { useCallback, useEffect, useRef } from 'react'
import { saveSession } from '../sessionStore'
import { uid } from '../utils'

const DEFAULT_DEBOUNCE_MS = 400

export default function SessionAutosave({
  initialSession,
  projectName,
  keypointDefs,
  edges,
  images,
  annotations,
  currentImageId,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}) {
  const timerRef = useRef(null)
  const queueRef = useRef(Promise.resolve())
  const latestRef = useRef(null)
  const initialSessionRef = useRef(initialSession)
  const sessionIdRef = useRef(null)
  const createdAtRef = useRef(null)

  const enqueueLatest = useCallback(() => {
    const snapshot = latestRef.current
    latestRef.current = null
    if (!snapshot) return

    queueRef.current = queueRef.current
      .catch(() => {})
      .then(() => saveSession(snapshot))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (sessionIdRef.current === null) {
      sessionIdRef.current = initialSessionRef.current?.id || uid()
    }
    if (createdAtRef.current === null) {
      createdAtRef.current = initialSessionRef.current?.createdAt ?? Date.now()
    }
    latestRef.current = {
      id: sessionIdRef.current,
      createdAt: createdAtRef.current,
      projectName,
      keypointDefs,
      edges,
      images,
      annotations: annotations || {},
      currentImageId: currentImageId || null,
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(enqueueLatest, Math.max(0, debounceMs))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [annotations, currentImageId, debounceMs, edges, enqueueLatest, images, keypointDefs, projectName])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const flush = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      enqueueLatest()
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [enqueueLatest])

  return null
}
