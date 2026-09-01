import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const statusTimerRef = useRef(null)
  const [status, setStatus] = useState('idle')

  const enqueueLatest = useCallback(() => {
    const snapshot = latestRef.current
    latestRef.current = null
    if (!snapshot) return

    setStatus('saving')
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    queueRef.current = queueRef.current
      .catch(() => {})
      .then(() => saveSession(snapshot))
      .then(
        () => {
          setStatus('saved')
          statusTimerRef.current = setTimeout(() => setStatus('idle'), 1400)
        },
        () => setStatus('error')
      )
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
    return () => {
      window.removeEventListener('pagehide', flush)
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    }
  }, [enqueueLatest])

  if (status === 'idle') return null

  const statusTarget = document.querySelector('.sidebar-header')
  if (!statusTarget) return null

  return createPortal(
    <div
      className={`autosave-status ${status}`}
      role={status === 'error' ? 'alert' : 'status'}
      aria-live={status === 'error' ? 'assertive' : 'polite'}
    >
      {status === 'saving' && '자동 저장 중…'}
      {status === 'saved' && '자동 저장됨'}
      {status === 'error' && '자동 저장 실패 · 페이지를 닫지 마세요'}
    </div>,
    statusTarget
  )
}
