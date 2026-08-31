import { useState } from 'react'

export default function ProjectSetup({ onCreate }) {
  const [name, setName] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim())
  }

  return (
    <div className="center-screen">
      <form className="card" onSubmit={submit}>
        <h1>Skeleton Keypoint Labeler</h1>
        <p className="muted">새 프로젝트를 만들어 시작하세요.</p>
        <label className="field">
          <span>프로젝트 이름</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 사람 포즈 라벨링"
          />
        </label>
        <button className="btn primary" type="submit" disabled={!name.trim()}>
          프로젝트 생성
        </button>
      </form>
    </div>
  )
}
