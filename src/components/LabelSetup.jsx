import { useEffect, useRef, useState } from 'react'
import { KP_COLORS, uid, loadImageFiles } from '../utils'

const CANVAS = 400 // 템플릿 캔버스 좌표계 크기

export default function LabelSetup({ projectName, onDone }) {
  const [defs, setDefs] = useState([]) // {id, name, color, tx, ty}
  const [edges, setEdges] = useState([]) // [defIdA, defIdB]
  const [selected, setSelected] = useState(null) // 선 연결용 선택된 포인트 id
  const [cursor, setCursor] = useState(null) // 자동 연결 미리보기용 커서 위치
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)

  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const fileRef = useRef(null)
  const folderRef = useRef(null)

  const toCanvas = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS,
    }
  }

  const autoName = () => {
    let n = defs.length + 1
    while (defs.some((d) => d.name === `point_${n}`)) n++
    return `point_${n}`
  }

  // 빈 캔버스 클릭 → 포인트 추가 + 선택된 포인트와 자동으로 선 연결
  const onCanvasDown = (e) => {
    if (e.button !== 0) return
    const p = toCanvas(e)
    const def = {
      id: uid(),
      name: autoName(),
      color: KP_COLORS[defs.length % KP_COLORS.length],
      tx: p.x,
      ty: p.y,
    }
    setDefs([...defs, def])
    if (selected) setEdges([...edges, [selected, def.id]])
    // 방금 찍은 포인트를 선택 상태로 두어 계속 클릭하면 선이 이어지게
    setSelected(def.id)
  }

  // 포인트 드래그(이동) 또는 클릭(선택/연결) — 이동량으로 구분
  const onPointDown = (e, id) => {
    if (e.button !== 0) return
    e.stopPropagation()
    dragRef.current = { id, moved: false, last: toCanvas(e) }
    svgRef.current.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const p = toCanvas(e)
    const drag = dragRef.current
    if (!drag) {
      setCursor(selected ? p : null)
      return
    }
    if (!drag.moved && Math.hypot(p.x - drag.last.x, p.y - drag.last.y) < 4) return
    drag.moved = true
    drag.last = p
    setDefs((cur) =>
      cur.map((d) =>
        d.id === drag.id
          ? { ...d, tx: Math.max(0, Math.min(CANVAS, p.x)), ty: Math.max(0, Math.min(CANVAS, p.y)) }
          : d
      )
    )
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.moved) return
    // 클릭: 그 포인트를 다음 선의 시작점으로 선택
    setSelected(drag.id)
  }

  const removeEdge = (a, b) =>
    setEdges((cur) => cur.filter(([x, y]) => !(x === a && y === b)))

  const removePoint = (id) => {
    setDefs(defs.filter((d) => d.id !== id))
    setEdges(edges.filter(([a, b]) => a !== id && b !== id))
    if (selected === id) setSelected(null)
  }

  const renamePoint = (id, name) =>
    setDefs(defs.map((d) => (d.id === id ? { ...d, name } : d)))

  // Esc로 선택 해제, Delete로 선택 포인트 삭제
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'Escape') setSelected(null)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) removePoint(selected)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const handleFiles = async (fileList) => {
    if (!fileList?.length) return
    setLoading(true)
    const loaded = await loadImageFiles(fileList)
    setImages((prev) => [...prev, ...loaded])
    setLoading(false)
  }

  const ready = defs.length > 0 && images.length > 0
  const byId = Object.fromEntries(defs.map((d) => [d.id, d]))

  return (
    <div className="center-screen">
      <div className="card wide setup-card">
        <h1>{projectName}</h1>
        <p className="muted">
          기준 스켈레톤을 캔버스에 그리고, 라벨링할 이미지를 업로드하세요.
        </p>

        <section className="setup-section">
          <h2>1. 기준 스켈레톤 그리기</h2>
          <p className="muted small task-instruction">
            빈 곳 클릭 = 포인트 추가 (선택된 포인트에서 선이 자동으로 이어짐) · 포인트 클릭 =
            그 점을 선의 시작점으로 선택 (가지 치기) · 선 클릭 = 선 삭제 · Esc = 연결 끊고 새로
            시작 · 포인트 드래그 = 이동 · Delete = 선택 포인트 삭제
          </p>
          <div className="tpl-layout">
            <svg
              ref={svgRef}
              className="template-canvas"
              viewBox={`0 0 ${CANVAS} ${CANVAS}`}
              onPointerDown={onCanvasDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => setCursor(null)}
            >
              <defs>
                <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
                  <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#2c313c" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={CANVAS} height={CANVAS} fill="url(#grid)" />
              {edges.map(([a, b]) => {
                const pa = byId[a]
                const pb = byId[b]
                if (!pa || !pb) return null
                return (
                  <g key={`${a}-${b}`} className="edge-group">
                    <line x1={pa.tx} y1={pa.ty} x2={pb.tx} y2={pb.ty} className="skeleton-edge" />
                    {/* 클릭하면 선 삭제 (넓은 투명 히트 영역) */}
                    <line
                      x1={pa.tx}
                      y1={pa.ty}
                      x2={pb.tx}
                      y2={pb.ty}
                      className="edge-hit"
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        removeEdge(a, b)
                      }}
                    />
                  </g>
                )
              })}
              {selected && cursor && byId[selected] && (
                <line
                  className="preview-edge"
                  x1={byId[selected].tx}
                  y1={byId[selected].ty}
                  x2={cursor.x}
                  y2={cursor.y}
                />
              )}
              {defs.map((d) => (
                <g key={d.id}>
                  {selected === d.id && (
                    <circle cx={d.tx} cy={d.ty} r={13} className="select-ring" />
                  )}
                  <circle
                    cx={d.tx}
                    cy={d.ty}
                    r={8}
                    fill={d.color}
                    className="tpl-point"
                    onPointerDown={(e) => onPointDown(e, d.id)}
                  />
                  <text x={d.tx + 12} y={d.ty - 10} className="tpl-label" fill={d.color}>
                    {d.name}
                  </text>
                </g>
              ))}
              {defs.length === 0 && (
                <text x={CANVAS / 2} y={CANVAS / 2} className="tpl-empty">
                  클릭해서 포인트를 추가하세요
                </text>
              )}
            </svg>

            <ul className="kp-list tpl-list">
              {defs.map((d, i) => (
                <li key={d.id} className={selected === d.id ? 'active' : ''}>
                  <span className="kp-dot" style={{ background: d.color }} />
                  <span className="kp-index">{i + 1}</span>
                  <input
                    className="kp-rename"
                    value={d.name}
                    onChange={(e) => renamePoint(d.id, e.target.value)}
                  />
                  <button className="btn tiny danger" onClick={() => removePoint(d.id)}>
                    삭제
                  </button>
                </li>
              ))}
              {defs.length === 0 && (
                <li className="muted small empty">아직 포인트가 없습니다.</li>
              )}
            </ul>
          </div>
        </section>

        <section className="setup-section">
          <h2>2. 이미지 업로드</h2>
          <div className="row">
            <button className="btn" onClick={() => fileRef.current.click()}>
              이미지 선택
            </button>
            <button className="btn" onClick={() => folderRef.current.click()}>
              폴더 선택
            </button>
            <span className="muted small">
              {loading ? '불러오는 중…' : `${images.length}장 업로드됨`}
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <input
            ref={folderRef}
            type="file"
            webkitdirectory=""
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          {images.length > 0 && (
            <div className="thumb-grid">
              {images.slice(0, 12).map((img) => (
                <img key={img.id} src={img.url} alt={img.name} title={img.name} />
              ))}
              {images.length > 12 && (
                <div className="thumb-more">+{images.length - 12}</div>
              )}
            </div>
          )}
        </section>

        <button
          className="btn primary big"
          disabled={!ready}
          onClick={() => onDone(defs, edges, images)}
        >
          라벨링 시작
        </button>
        {!ready && (
          <p className="muted small task-instruction">
            포인트를 1개 이상 찍고 이미지를 업로드하면 시작할 수 있습니다.
          </p>
        )}
      </div>
    </div>
  )
}
