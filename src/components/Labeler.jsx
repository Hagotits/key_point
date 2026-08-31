import { useCallback, useEffect, useRef, useState } from 'react'
import { createHistory } from '../history.js'
import { uid, loadImageFiles } from '../utils'
import SessionAutosave from './SessionAutosave'

// 설정 단계에서 그린 기준 스켈레톤 모양을 bbox 안에 맞춰 초기 배치.
// 드래그 방향(4방향 스냅)에 맞춰 회전: 드래그 시작 지점이 템플릿의 위쪽(예: 머리)이 된다.
function layoutKeypoints(defs, box, delta = { x: 0, y: 1 }) {
  let theta
  if (Math.abs(delta.x) >= Math.abs(delta.y)) {
    theta = delta.x >= 0 ? -Math.PI / 2 : Math.PI / 2
  } else {
    theta = delta.y >= 0 ? 0 : Math.PI
  }
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const cx = defs.reduce((s, d) => s + d.tx, 0) / defs.length
  const cy = defs.reduce((s, d) => s + d.ty, 0) / defs.length
  const pts = defs.map((d) => ({
    defId: d.id,
    x: cx + (d.tx - cx) * cos - (d.ty - cy) * sin,
    y: cy + (d.tx - cx) * sin + (d.ty - cy) * cos,
  }))
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const tw = maxX - minX
  const th = maxY - minY
  const pad = 0.06
  return pts.map((p) => {
    const nx = tw === 0 ? 0.5 : (p.x - minX) / tw
    const ny = th === 0 ? 0.5 : (p.y - minY) / th
    return {
      defId: p.defId,
      x: box.x + box.w * (pad + nx * (1 - pad * 2)),
      y: box.y + box.h * (pad + ny * (1 - pad * 2)),
      v: 2, // 가시성: 2=보임, 1=가려짐(추정), 0=없음(좌표 null)
    }
  })
}

const V_LABELS = { 2: '보임', 1: '가려짐', 0: '없음' }
const VISIBILITY_OPTIONS = [
  { shortcut: '1', value: 0, label: '없음' },
  { shortcut: '2', value: 1, label: '가려짐' },
  { shortcut: '3', value: 2, label: '보임' },
]
const VISIBILITY_BY_SHORTCUT = { 1: 0, 2: 1, 3: 2 }
const histories = new WeakMap()

function getHistory(owner, initialState) {
  if (!histories.has(owner)) {
    histories.set(owner, createHistory(initialState, { limit: 100 }))
  }
  return histories.get(owner)
}

export default function Labeler({
  projectName,
  keypointDefs,
  edges,
  images,
  onAddImages,
  initialSession,
}) {
  const [currentId, setCurrentId] = useState(() => {
    const restoredId = initialSession?.currentImageId
    return images.some((im) => im.id === restoredId) ? restoredId : images[0]?.id ?? null
  })
  const [annotations, setAnnotations] = useState(
    () => initialSession?.annotations || {}
  ) // imageId -> [instance]
  const [selectedId, setSelectedId] = useState(null)
  const [selectedKp, setSelectedKp] = useState(null) // {instId, defId} 단축키 대상 포인트
  const [placing, setPlacing] = useState(null) // {instId, defId} v=0 포인트 다시 찍기 모드
  const [draft, setDraft] = useState(null) // 그리는 중인 bbox
  const [baseScale, setBaseScale] = useState(1) // 이미지 원본 대비 화면 표시 배율 (줌 제외)
  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 }) // 줌 배율 + 이동량(화면 px)
  const [spacePan, setSpacePan] = useState(false) // Space 누른 상태 = 드래그로 화면 이동
  const [pointSize, setPointSize] = useState(4) // 키포인트 반지름 (화면 px 기준)
  const [labelMode, setLabelMode] = useState('all') // 이름 표시: all | selected | none

  const svgRef = useRef(null)
  const imgRef = useRef(null)
  const dragRef = useRef(null)
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const wrapRef = useRef(null)
  const holderRef = useRef(null)
  const history = getHistory(setAnnotations, annotations)

  const image = images.find((im) => im.id === currentId) || images[0]
  const imageId = image?.id
  const instances = annotations[image?.id] || []
  const scale = baseScale * view.z // 원본 좌표 → 화면 px 변환 배율

  // 화면 표시 배율 추적 (핸들/포인트 크기를 화면 기준으로 일정하게)
  useEffect(() => {
    const img = imgRef.current
    if (!img || !image) return
    const update = () => {
      if (img.clientWidth) setBaseScale(img.clientWidth / image.width)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(img)
    return () => ro.disconnect()
  }, [image])

  // 휠 줌 (커서 위치 기준). preventDefault를 위해 non-passive로 직접 등록
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const holder = holderRef.current
      if (!holder) return
      const rect = holder.getBoundingClientRect()
      setView((v) => {
        const nz = Math.min(16, Math.max(1, v.z * Math.exp(-e.deltaY * 0.0015)))
        if (nz === v.z) return v
        if (nz === 1) return { z: 1, tx: 0, ty: 0 }
        // 커서 아래 지점이 고정되도록 이동량 보정
        const qx = (e.clientX - rect.left) / v.z
        const qy = (e.clientY - rect.top) / v.z
        return { z: nz, tx: v.tx + (v.z - nz) * qx, ty: v.ty + (v.z - nz) * qy }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Space 누르고 있는 동안 드래그 = 화면 이동
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault()
        setSpacePan(true)
      }
    }
    const up = (e) => {
      if (e.code === 'Space') setSpacePan(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const setInstances = useCallback(
    (updater) => {
      setAnnotations((prev) => {
        if (!imageId) return prev
        const cur = prev[imageId] || []
        return { ...prev, [imageId]: typeof updater === 'function' ? updater(cur) : updater }
      })
    },
    [imageId]
  )

  const commitAnnotations = (next) => {
    if (!history.commit(next)) return false
    setAnnotations({ ...next })
    return true
  }

  const commitCurrentAnnotations = () => {
    setAnnotations((current) => {
      if (!history.commit(current)) return current
      return { ...current }
    })
  }

  const commitInstances = (updater) => {
    if (!image) return false
    const current = annotations[image.id] || []
    const nextInstances = typeof updater === 'function' ? updater(current) : updater
    return commitAnnotations({ ...annotations, [image.id]: nextInstances })
  }

  const applyHistory = (operation) => {
    const next = history[operation]()
    if (next === undefined) return
    setAnnotations(next)
    setSelectedId(null)
    setSelectedKp(null)
    setPlacing(null)
  }

  // 클라이언트 좌표 → 이미지 원본 좌표
  const toImageCoords = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * image.width,
      y: ((e.clientY - rect.top) / rect.height) * image.height,
    }
  }

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

  // --- 드래그 시작 핸들러들 ---
  // v 값 변경. v=0이면 좌표를 null로 비우고, v>=1인데 좌표가 없으면 박스 중앙에 배치
  const setKpV = useCallback(
    (instId, defId, v) => {
      if (!imageId) return
      setAnnotations((current) => {
        const nextInstances = (current[imageId] || []).map((inst) => {
          if (inst.id !== instId) return inst
          return {
            ...inst,
            keypoints: inst.keypoints.map((k) => {
              if (k.defId !== defId) return k
              if (v === 0) return { ...k, v: 0, x: null, y: null }
              if (k.x == null || k.y == null)
                return { ...k, v, x: inst.x + inst.w / 2, y: inst.y + inst.h / 2 }
              return { ...k, v }
            }),
          }
        })
        const next = { ...current, [imageId]: nextInstances }
        if (!getHistory(setAnnotations, current).commit(next)) return current
        return next
      })
    },
    [imageId]
  )

  const cycleKpV = useCallback(
    (instId, defId) => {
      const inst = (annotations[imageId] || []).find((i) => i.id === instId)
      const k = inst?.keypoints.find((k) => k.defId === defId)
      if (!k) return
      setKpV(instId, defId, k.v === 2 ? 1 : k.v === 1 ? 0 : 2)
    },
    [annotations, imageId, setKpV]
  )

  const startDrawBox = (e) => {
    // 휠 버튼 드래그 또는 Space+드래그 = 화면 이동(팬)
    if (e.button === 1 || (e.button === 0 && spacePan)) {
      e.preventDefault()
      dragRef.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, origT: { ...view } }
      svgRef.current.setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return
    const p = toImageCoords(e)
    // v=0 포인트 다시 찍기 모드: 클릭 위치에 배치하고 v=2로
    if (placing) {
      const { instId, defId } = placing
      const x = clamp(p.x, 0, image.width)
      const y = clamp(p.y, 0, image.height)
      commitInstances((cur) =>
        cur.map((inst) =>
          inst.id === instId
            ? {
                ...inst,
                keypoints: inst.keypoints.map((k) =>
                  k.defId === defId ? { ...k, x, y, v: 2 } : k
                ),
              }
            : inst
        )
      )
      setSelectedId(instId)
      setSelectedKp({ instId, defId })
      setPlacing(null)
      return
    }
    dragRef.current = { mode: 'draw', start: p }
    setSelectedId(null)
    setSelectedKp(null)
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 })
    svgRef.current.setPointerCapture(e.pointerId)
  }

  const startMoveBox = (e, inst) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const p = toImageCoords(e)
    dragRef.current = {
      mode: 'move',
      instId: inst.id,
      start: p,
      orig: {
        x: inst.x,
        y: inst.y,
        w: inst.w,
        h: inst.h,
        keypoints: inst.keypoints.map((k) => ({ ...k })),
      },
    }
    setSelectedId(inst.id)
    setSelectedKp(null)
    svgRef.current.setPointerCapture(e.pointerId)
  }

  const startResize = (e, inst, handle) => {
    if (e.button !== 0) return
    e.stopPropagation()
    dragRef.current = {
      mode: 'resize',
      instId: inst.id,
      handle,
      start: toImageCoords(e),
      orig: { x: inst.x, y: inst.y, w: inst.w, h: inst.h, keypoints: inst.keypoints.map((k) => ({ ...k })) },
    }
    setSelectedId(inst.id)
    svgRef.current.setPointerCapture(e.pointerId)
  }

  const startMovePoint = (e, inst, defId) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const p = toImageCoords(e)
    const k = inst.keypoints.find((kp) => kp.defId === defId)
    dragRef.current = {
      mode: 'point',
      instId: inst.id,
      defId,
      // 잡은 지점과 포인트 중심의 오프셋을 유지해 드래그 시 점이 커서로 튀지 않게
      offX: (k?.x ?? p.x) - p.x,
      offY: (k?.y ?? p.y) - p.y,
    }
    setSelectedId(inst.id)
    setSelectedKp({ instId: inst.id, defId })
    svgRef.current.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.mode === 'pan') {
      setView((v) => ({
        ...v,
        tx: drag.origT.tx + (e.clientX - drag.sx),
        ty: drag.origT.ty + (e.clientY - drag.sy),
      }))
      return
    }
    const p = toImageCoords(e)

    if (drag.mode === 'draw') {
      // 이미지 바깥으로는 박스가 그려지지 않게 커서 위치를 경계로 제한
      const px = clamp(p.x, 0, image.width)
      const py = clamp(p.y, 0, image.height)
      drag.last = { x: px, y: py } // 회전 방향 계산용
      setDraft({
        x: Math.min(drag.start.x, px),
        y: Math.min(drag.start.y, py),
        w: Math.abs(px - drag.start.x),
        h: Math.abs(py - drag.start.y),
      })
    } else if (drag.mode === 'resize') {
      const o = drag.orig
      const minS = 8 / scale
      const dx = p.x - drag.start.x
      const dy = p.y - drag.start.y
      let { x, y, w, h } = o
      if (drag.handle.includes('e')) w = clamp(o.w + dx, minS, image.width - o.x)
      if (drag.handle.includes('w')) {
        x = clamp(o.x + dx, 0, o.x + o.w - minS)
        w = o.x + o.w - x
      }
      if (drag.handle.includes('s')) h = clamp(o.h + dy, minS, image.height - o.y)
      if (drag.handle.includes('n')) {
        y = clamp(o.y + dy, 0, o.y + o.h - minS)
        h = o.y + o.h - y
      }
      setInstances((cur) =>
        cur.map((inst) =>
          inst.id === drag.instId
            ? {
                ...inst,
                x, y, w, h,
                // 키포인트도 박스에 대한 상대 위치를 유지하며 함께 스케일
                keypoints: o.keypoints.map((k) =>
                  k.x == null
                    ? { ...k }
                    : {
                        ...k,
                        x: clamp(x + ((k.x - o.x) / o.w) * w, 0, image.width),
                        y: clamp(y + ((k.y - o.y) / o.h) * h, 0, image.height),
                      }
                ),
              }
            : inst
        )
      )
    } else if (drag.mode === 'move') {
      // 박스가 이미지 밖으로 나가지 않게 이동량을 제한
      const nx = clamp(drag.orig.x + (p.x - drag.start.x), 0, Math.max(0, image.width - drag.orig.w))
      const ny = clamp(drag.orig.y + (p.y - drag.start.y), 0, Math.max(0, image.height - drag.orig.h))
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return
      const dx = nx - drag.orig.x
      const dy = ny - drag.orig.y
      setInstances((cur) =>
        cur.map((inst) =>
          inst.id === drag.instId
            ? {
                ...inst,
                x: nx,
                y: ny,
                keypoints: drag.orig.keypoints.map((k) =>
                  k.x == null
                    ? { ...k }
                    : {
                        ...k,
                        x: clamp(k.x + dx, 0, image.width),
                        y: clamp(k.y + dy, 0, image.height),
                      }
                ),
              }
            : inst
        )
      )
    } else if (drag.mode === 'point') {
      const x = clamp(p.x + drag.offX, 0, image.width)
      const y = clamp(p.y + drag.offY, 0, image.height)
      setInstances((cur) =>
        cur.map((inst) =>
          inst.id === drag.instId
            ? {
                ...inst,
                keypoints: inst.keypoints.map((k) =>
                  k.defId === drag.defId ? { ...k, x, y } : k
                ),
              }
            : inst
        )
      )
    }
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.mode !== 'draw') {
      if (['move', 'resize', 'point'].includes(drag.mode)) commitCurrentAnnotations()
      return
    }
    // 너무 작은 박스(클릭 수준)는 무시
    if (draft && draft.w > 8 / scale && draft.h > 8 / scale) {
      const delta = drag.last
        ? { x: drag.last.x - drag.start.x, y: drag.last.y - drag.start.y }
        : { x: 0, y: 1 }
      const inst = {
        id: uid(),
        ...draft,
        keypoints: layoutKeypoints(keypointDefs, draft, delta),
      }
      commitInstances((cur) => [...cur, inst])
      setSelectedId(inst.id)
    }
    setDraft(null)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
      const key = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && key === 'z') {
        e.preventDefault()
        const next = history[e.shiftKey ? 'redo' : 'undo']()
        if (next !== undefined) {
          setAnnotations(next)
          setSelectedId(null)
          setSelectedKp(null)
          setPlacing(null)
        }
        return
      }
      if (e.key === 'Escape') {
        setPlacing(null)
        setSelectedKp(null)
        return
      }
      if (selectedKp) {
        const shortcutValue = VISIBILITY_BY_SHORTCUT[e.key]
        if (shortcutValue !== undefined) {
          setKpV(selectedKp.instId, selectedKp.defId, shortcutValue)
          e.preventDefault()
          return
        }
        if (e.key === 'v' || e.key === 'V') {
          cycleKpV(selectedKp.instId, selectedKp.defId)
          return
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          setKpV(selectedKp.instId, selectedKp.defId, 0)
          return
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        if (!imageId) return
        setAnnotations((current) => {
          const next = {
            ...current,
            [imageId]: (current[imageId] || []).filter((inst) => inst.id !== selectedId),
          }
          if (!history.commit(next)) return current
          return next
        })
        setSelectedId(null)
        setSelectedKp(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycleKpV, history, imageId, selectedId, selectedKp, setKpV])

  const exportJSON = () => {
    const nameOf = (id) => keypointDefs.find((d) => d.id === id)?.name

    // 저장 전 검증
    const problems = []
    const allZero = []
    images.forEach((im) => {
      ;(annotations[im.id] || []).forEach((inst, idx) => {
        inst.keypoints.forEach((k) => {
          const kpName = nameOf(k.defId)
          if (k.v === 0 && (k.x != null || k.y != null))
            problems.push(`${im.name} / 객체 ${idx + 1} / ${kpName}: v=0인데 좌표가 있음`)
          if (k.v >= 1 && (k.x == null || k.y == null))
            problems.push(`${im.name} / 객체 ${idx + 1} / ${kpName}: v=${k.v}인데 좌표가 없음`)
        })
        if (inst.keypoints.length > 0 && inst.keypoints.every((k) => k.v === 0))
          allZero.push(`${im.name} / 객체 ${idx + 1}`)
      })
    })
    if (problems.length > 0) {
      alert(
        `저장할 수 없습니다. 다음 키포인트를 확인하세요:\n\n` +
          problems.slice(0, 15).join('\n') +
          (problems.length > 15 ? `\n… 외 ${problems.length - 15}건` : '')
      )
      return
    }
    if (allZero.length > 0) {
      const ok = confirm(
        `모든 키포인트가 v=0(없음)인 객체가 있습니다. 실수일 수 있습니다:\n\n` +
          allZero.slice(0, 10).join('\n') +
          (allZero.length > 10 ? `\n… 외 ${allZero.length - 10}건` : '') +
          `\n\n그래도 저장할까요?`
      )
      if (!ok) return
    }

    const data = {
      project: projectName,
      keypoints: keypointDefs.map((d) => d.name),
      visibility: {
        0: 'not labeled, x/y null',
        1: 'occluded, estimated',
        2: 'visible',
      },
      skeleton: edges.map(([a, b]) => [nameOf(a), nameOf(b)]),
      images: images.map((im) => ({
        name: im.name,
        width: im.width,
        height: im.height,
        annotations: (annotations[im.id] || []).map((inst) => ({
          bbox: [
            Math.round(inst.x),
            Math.round(inst.y),
            Math.round(inst.w),
            Math.round(inst.h),
          ],
          keypoints: inst.keypoints.map((k) => ({
            name: nameOf(k.defId),
            x: k.x == null ? null : Math.round(k.x),
            y: k.y == null ? null : Math.round(k.y),
            v: k.v,
          })),
        })),
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(blob)
  }

  const downloadBlob = (blob) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${projectName.replace(/\s+/g, '_')}_annotations.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // 어노테이션 JSON 불러오기. v 필드가 없는 기존 파일은
  // 좌표가 있으면 v=2, 없으면 v=0으로 간주한다.
  const importJSON = async (file) => {
    let data
    try {
      data = JSON.parse(await file.text())
    } catch {
      alert('JSON 파일을 읽을 수 없습니다.')
      return
    }
    const base = (n) => String(n || '').split('/').pop()
    const defByName = Object.fromEntries(keypointDefs.map((d) => [d.name, d]))
    const unknownKps = new Set()
    const skippedImages = []
    const imported = {}
    let count = 0

    for (const entry of data.images || []) {
      const im = images.find((i) => i.name === entry.name || base(i.name) === base(entry.name))
      if (!im) {
        if (entry.annotations?.length) skippedImages.push(entry.name)
        continue
      }
      imported[im.id] = (entry.annotations || []).map((a) => {
        const byName = {}
        for (const k of a.keypoints || []) {
          if (!defByName[k.name]) unknownKps.add(k.name)
          byName[k.name] = k
        }
        return {
          id: uid(),
          x: a.bbox?.[0] ?? 0,
          y: a.bbox?.[1] ?? 0,
          w: a.bbox?.[2] ?? 0,
          h: a.bbox?.[3] ?? 0,
          // 정의된 키포인트 개수만큼 항상 채운다 (파일에 없으면 v=0)
          keypoints: keypointDefs.map((d) => {
            const k = byName[d.name]
            const has = k && k.x != null && k.y != null
            let v = k?.v != null ? k.v : has ? 2 : 0
            if (![0, 1, 2].includes(v)) v = has ? 2 : 0
            return v === 0 || !has
              ? { defId: d.id, x: null, y: null, v: 0 }
              : { defId: d.id, x: k.x, y: k.y, v }
          }),
        }
      })
      count++
    }

    commitAnnotations({ ...annotations, ...imported })
    let msg = `${count}개 이미지의 어노테이션을 불러왔습니다.`
    if (skippedImages.length)
      msg += `\n\n업로드된 이미지 중에 없어서 건너뜀: ${skippedImages.slice(0, 5).join(', ')}${skippedImages.length > 5 ? ` 외 ${skippedImages.length - 5}건` : ''}`
    if (unknownKps.size)
      msg += `\n\n현재 프로젝트에 정의되지 않아 무시된 키포인트: ${[...unknownKps].join(', ')}`
    alert(msg)
  }

  if (!image) return <div className="center-screen">이미지가 없습니다.</div>

  const pointR = pointSize / scale // 키포인트 반지름
  const strokeW = 1.2 / scale // 바운딩 박스 선 굵기 (화면 기준)
  // 스켈레톤 선 굵기도 포인트 크기에 비례
  const edgeW = Math.max(0.5, pointSize * 0.6) / scale
  // 포인트 크기에 비례해 이름 글씨도 함께 줄어든다
  const fontSize = Math.min(13, pointSize * 2.2) / scale
  const selectedInstance = instances.find((inst) => inst.id === selectedId)
  const selectedInstanceIndex = instances.findIndex((inst) => inst.id === selectedId)

  return (
    <div className="labeler">
      {/* 왼쪽: 이미지 목록 */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 title={projectName}>{projectName}</h2>
          <button className="btn small" onClick={() => fileRef.current.click()}>
            + 이미지 추가
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={async (e) => {
              const loaded = await loadImageFiles(e.target.files)
              onAddImages(loaded)
              e.target.value = ''
            }}
          />
        </div>
        <ul className="image-list">
          {images.map((im) => {
            const count = (annotations[im.id] || []).length
            return (
              <li
                key={im.id}
                className={im.id === image.id ? 'active' : ''}
                onClick={() => {
                  setCurrentId(im.id)
                  setSelectedId(null)
                  setSelectedKp(null)
                  setPlacing(null)
                  setView({ z: 1, tx: 0, ty: 0 })
                }}
              >
                <img src={im.url} alt="" />
                <span className="image-name" title={im.name}>{im.name}</span>
                {count > 0 && <span className="badge">{count}</span>}
              </li>
            )
          })}
        </ul>
        <div className="sidebar-actions">
          <button className="btn export" onClick={() => importRef.current.click()}>
            JSON 불러오기
          </button>
          <button className="btn primary" onClick={exportJSON}>
            JSON 내보내기
          </button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            if (e.target.files[0]) importJSON(e.target.files[0])
            e.target.value = ''
          }}
        />
      </aside>

      {/* 가운데: 캔버스 */}
      <main className="canvas-area">
        <div className="canvas-toolbar">
          {placing ? (
            <span className="canvas-hint-text placing-hint">
              포인트 다시 찍기:{' '}
              <b>{keypointDefs.find((d) => d.id === placing.defId)?.name}</b> — 원하는 위치를
              클릭하세요 (Esc = 취소)
            </span>
          ) : (
            <span className="canvas-hint-text">
              드래그 = 박스 그리기 (시작 지점이 스켈레톤 위쪽) · <b>휠</b> = 줌 ·{' '}
              <b>Space/휠버튼 드래그</b> = 화면 이동 · 포인트 클릭 후 <b>1</b> 없음 ·{' '}
              <b>2</b> 가려짐 · <b>3</b> 보임 · <b>V</b> = 순환 · Delete = 포인트 없음 / 박스 삭제
            </span>
          )}
          <div className="history-controls" aria-label="편집 기록">
            <button
              type="button"
              className="btn tiny"
              disabled={!history.canUndo()}
              onClick={() => applyHistory('undo')}
              title="Cmd/Ctrl+Z"
            >
              실행 취소
            </button>
            <button
              type="button"
              className="btn tiny"
              disabled={!history.canRedo()}
              onClick={() => applyHistory('redo')}
              title="Cmd/Ctrl+Shift+Z"
            >
              다시 실행
            </button>
          </div>
          <span className="point-size-control" title="마우스 휠로 확대/축소">
            <span>줌 {Math.round(view.z * 100)}%</span>
            {view.z !== 1 && (
              <button className="btn tiny" onClick={() => setView({ z: 1, tx: 0, ty: 0 })}>
                초기화
              </button>
            )}
          </span>
          <label className="point-size-control" title="포인트 이름 표시 방식">
            <span>이름</span>
            <select
              className="label-mode-select"
              value={labelMode}
              onChange={(e) => setLabelMode(e.target.value)}
            >
              <option value="all">항상 표시</option>
              <option value="selected">선택한 포인트만</option>
              <option value="none">숨김</option>
            </select>
          </label>
          <label className="point-size-control" title="키포인트 표시 크기">
            <span>포인트 크기</span>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={pointSize}
              onChange={(e) => setPointSize(Number(e.target.value))}
            />
            <span className="point-size-value">{pointSize}px</span>
          </label>
        </div>
        <div className="canvas-wrap" ref={wrapRef}>
          <div
            className="image-holder"
            ref={holderRef}
            style={{
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`,
              transformOrigin: '0 0',
            }}
          >
            <img ref={imgRef} src={image.url} alt={image.name} draggable={false} />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${image.width} ${image.height}`}
              style={spacePan ? { cursor: 'grab' } : undefined}
              onPointerDown={startDrawBox}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {instances.map((inst, instanceIndex) => (
                <g key={inst.id}>
                  <rect
                    className={`bbox ${inst.id === selectedId ? 'selected' : ''}`}
                    x={inst.x}
                    y={inst.y}
                    width={inst.w}
                    height={inst.h}
                    strokeWidth={strokeW}
                    onPointerDown={(e) => startMoveBox(e, inst)}
                  />
                  {inst.id === selectedId && (
                    <text
                      className="object-label"
                      x={inst.x + 6 / scale}
                      y={Math.max(14 / scale, inst.y - 6 / scale)}
                      fontSize={Math.max(11 / scale, fontSize)}
                    >
                      객체 {instanceIndex + 1}
                    </text>
                  )}
                  {edges.map(([a, b]) => {
                    const ka = inst.keypoints.find((k) => k.defId === a)
                    const kb = inst.keypoints.find((k) => k.defId === b)
                    // 한쪽이라도 v=0(좌표 없음)이면 선을 그리지 않음
                    if (!ka || !kb || ka.v === 0 || kb.v === 0 || ka.x == null || kb.x == null)
                      return null
                    const occluded = ka.v === 1 || kb.v === 1
                    return (
                      <line
                        key={`${a}-${b}`}
                        className="skeleton-edge"
                        x1={ka.x}
                        y1={ka.y}
                        x2={kb.x}
                        y2={kb.y}
                        strokeWidth={edgeW}
                        strokeDasharray={occluded ? `${5 / scale} ${4 / scale}` : undefined}
                      />
                    )
                  })}
                  {inst.keypoints.map((k) => {
                    if (k.v === 0 || k.x == null) return null // v=0은 캔버스에 그리지 않음
                    const def = keypointDefs.find((d) => d.id === k.defId)
                    const isSel =
                      selectedKp?.instId === inst.id && selectedKp?.defId === k.defId
                    return (
                      <g key={k.defId}>
                        {isSel && (
                          <circle
                            className="keypoint-selection-ring"
                            cx={k.x}
                            cy={k.y}
                            r={Math.max(pointR * 2.1, 12 / scale)}
                          />
                        )}
                        {/* 포인트가 작아도 잡기 쉽게 투명한 히트 영역을 겹침 */}
                        <circle
                          className="keypoint-hit"
                          cx={k.x}
                          cy={k.y}
                          r={Math.max(pointR, 8 / scale)}
                          onPointerDown={(e) => startMovePoint(e, inst, k.defId)}
                        />
                        {k.v === 2 ? (
                          <circle
                            className="keypoint"
                            cx={k.x}
                            cy={k.y}
                            r={pointR}
                            fill={def.color}
                            onPointerDown={(e) => startMovePoint(e, inst, k.defId)}
                          />
                        ) : (
                          // v=1 가려짐: 속이 빈 원
                          <circle
                            className="keypoint occluded"
                            cx={k.x}
                            cy={k.y}
                            r={pointR}
                            fill="none"
                            stroke={def.color}
                            strokeWidth={Math.max(1.5 / scale, pointR * 0.35)}
                            onPointerDown={(e) => startMovePoint(e, inst, k.defId)}
                          />
                        )}
                        {(labelMode === 'all' || isSel) && (
                          <text
                            className={`kp-label ${isSel ? 'selected' : ''}`}
                            x={k.x + pointR * 1.4 + 2 / scale}
                            y={k.y - pointR * 0.8 - 2 / scale}
                            fontSize={fontSize}
                            fill={def.color}
                          >
                            {isSel ? `${def.name} · 객체 ${instanceIndex + 1}` : def.name}
                          </text>
                        )}
                      </g>
                    )
                  })}
                  {/* 선택된 박스: 가장자리/모서리에 보이지 않는 크기 조절 영역 */}
                  {inst.id === selectedId &&
                    (() => {
                      const t = 10 / scale // 변 히트 영역 두께
                      const c = 14 / scale // 모서리 히트 영역 크기
                      const zones = [
                        ['n', inst.x + c / 2, inst.y - t / 2, Math.max(0, inst.w - c), t, 'ns-resize'],
                        ['s', inst.x + c / 2, inst.y + inst.h - t / 2, Math.max(0, inst.w - c), t, 'ns-resize'],
                        ['w', inst.x - t / 2, inst.y + c / 2, t, Math.max(0, inst.h - c), 'ew-resize'],
                        ['e', inst.x + inst.w - t / 2, inst.y + c / 2, t, Math.max(0, inst.h - c), 'ew-resize'],
                        ['nw', inst.x - c / 2, inst.y - c / 2, c, c, 'nwse-resize'],
                        ['ne', inst.x + inst.w - c / 2, inst.y - c / 2, c, c, 'nesw-resize'],
                        ['sw', inst.x - c / 2, inst.y + inst.h - c / 2, c, c, 'nesw-resize'],
                        ['se', inst.x + inst.w - c / 2, inst.y + inst.h - c / 2, c, c, 'nwse-resize'],
                      ]
                      return zones.map(([name, zx, zy, zw, zh, cursorStyle]) => (
                        <rect
                          key={name}
                          x={zx}
                          y={zy}
                          width={zw}
                          height={zh}
                          fill="transparent"
                          style={{ cursor: cursorStyle }}
                          onPointerDown={(e) => startResize(e, inst, name)}
                        />
                      ))
                    })()}
                </g>
              ))}
              {draft && (
                <rect
                  className="bbox draft"
                  x={draft.x}
                  y={draft.y}
                  width={draft.w}
                  height={draft.h}
                  strokeWidth={strokeW}
                />
              )}
            </svg>
          </div>
        </div>
      </main>

      {/* 오른쪽: 키포인트 범례 + 인스턴스 목록 */}
      <aside className="rightbar">
        <h3>기준 스켈레톤</h3>
        <svg className="tpl-preview" viewBox="0 0 400 400">
          {edges.map(([a, b]) => {
            const pa = keypointDefs.find((d) => d.id === a)
            const pb = keypointDefs.find((d) => d.id === b)
            if (!pa || !pb) return null
            return (
              <line
                key={`${a}-${b}`}
                className="skeleton-edge"
                x1={pa.tx}
                y1={pa.ty}
                x2={pb.tx}
                y2={pb.ty}
                strokeWidth={3}
              />
            )
          })}
          {keypointDefs.map((d) => (
            <circle key={d.id} cx={d.tx} cy={d.ty} r={9} fill={d.color} stroke="var(--text)" strokeWidth={2} />
          ))}
        </svg>
        <ul className="legend">
          {keypointDefs.map((d, i) => (
            <li key={d.id}>
              <span className="kp-dot" style={{ background: d.color }} />
              {i + 1}. {d.name}
            </li>
          ))}
        </ul>
        {selectedInstance && (
          <>
            <div className="selection-banner">
              <span className="selection-banner-title">선택된 객체</span>
              <strong>객체 {selectedInstanceIndex + 1}</strong>
              <span className="selection-banner-meta">
                {selectedInstance.keypoints.filter((k) => k.v === 2).length} 보임 ·{' '}
                {selectedInstance.keypoints.filter((k) => k.v === 1).length} 가려짐 ·{' '}
                {selectedInstance.keypoints.filter((k) => k.v === 0).length} 없음
              </span>
            </div>
            <h3>객체 {selectedInstanceIndex + 1}의 키포인트</h3>
            <ul className="kp-status-list">
              {selectedInstance.keypoints.map((k) => {
                const def = keypointDefs.find((d) => d.id === k.defId)
                const isSel =
                  selectedKp?.instId === selectedInstance.id && selectedKp?.defId === k.defId
                if (!def) return null
                return (
                  <li key={k.defId} className={isSel ? 'active' : ''}>
                    <button
                      type="button"
                      className="kp-select"
                      aria-pressed={isSel}
                      onClick={() => setSelectedKp({ instId: selectedInstance.id, defId: k.defId })}
                    >
                      <span className="kp-dot" style={{ background: def.color }} />
                      <span className="kp-status-name">{def.name}</span>
                    </button>
                    <div className="visibility-options" role="radiogroup" aria-label={`${def.name} 가시성`}>
                      {VISIBILITY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          className={`visibility-option v${option.value} ${k.v === option.value ? 'active' : ''}`}
                          aria-checked={k.v === option.value}
                          aria-label={`${def.name}: ${option.shortcut} ${V_LABELS[option.value]}`}
                          title={`단축키 ${option.shortcut}: ${V_LABELS[option.value]}`}
                          onClick={() => {
                            setSelectedKp({ instId: selectedInstance.id, defId: k.defId })
                            setKpV(selectedInstance.id, k.defId, option.value)
                          }}
                        >
                          <span className="visibility-shortcut">{option.shortcut}</span>
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                    {k.v === 0 && (
                      <button
                        type="button"
                        className="btn tiny place-btn"
                        title="캔버스를 클릭해 이 포인트를 다시 찍습니다"
                        onClick={() => {
                          setSelectedKp({ instId: selectedInstance.id, defId: k.defId })
                          setPlacing({ instId: selectedInstance.id, defId: k.defId })
                        }}
                      >
                        찍기
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <h3>이 이미지의 객체 ({instances.length})</h3>
        <ul className="instance-list">
          {instances.map((inst, i) => (
            <li key={inst.id} className={inst.id === selectedId ? 'active' : ''}>
              <button
                type="button"
                className="instance-select"
                aria-pressed={inst.id === selectedId}
                onClick={() => {
                  setSelectedId(inst.id)
                  setSelectedKp(null)
                }}
              >
                <span className="instance-index">{i + 1}</span>
                <span>객체 {i + 1}</span>
              </button>
              <button
                type="button"
                className="btn tiny danger"
                onClick={(e) => {
                  e.stopPropagation()
                  commitInstances((cur) => cur.filter((x) => x.id !== inst.id))
                  if (selectedId === inst.id) {
                    setSelectedId(null)
                    setSelectedKp(null)
                  }
                }}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <SessionAutosave
        initialSession={initialSession}
        projectName={projectName}
        keypointDefs={keypointDefs}
        edges={edges}
        images={images}
        annotations={annotations}
        currentImageId={currentId}
      />
    </div>
  )
}
