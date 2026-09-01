import { useEffect, useState } from 'react'
import { listSessions, loadSession } from '../sessionStore'

export default function ProjectSetup({ onCreate, onResume }) {
  const [name, setName] = useState('')
  const [recentSessions, setRecentSessions] = useState([])
  const [resumingId, setResumingId] = useState(null)
  const [recentError, setRecentError] = useState(false)

  useEffect(() => {
    let active = true
    listSessions()
      .then((sessions) => {
        if (active) setRecentSessions(sessions)
      })
      .catch(() => {
        if (active) setRecentError(true)
      })
    return () => {
      active = false
    }
  }, [])

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim())
  }

  const resume = async (id) => {
    setResumingId(id)
    setRecentError(false)
    try {
      const session = await loadSession(id)
      if (!session) throw new Error('Session no longer exists')
      await onResume(session)
    } catch {
      setRecentError(true)
      setResumingId(null)
    }
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
        {recentSessions.length > 0 && (
          <section className="setup-section" aria-labelledby="recent-sessions-title">
            <h2 id="recent-sessions-title">최근 세션</h2>
            <ul className="kp-list">
              {recentSessions.map((session) => (
                <li key={session.id}>
                  <span className="kp-name">
                    <b>{session.projectName || '이름 없는 프로젝트'}</b>
                    <span className="muted small">
                      {session.images.length}장 ·{' '}
                      {new Date(session.updatedAt).toLocaleString()}
                    </span>
                  </span>
                  <button
                    className="btn tiny"
                    type="button"
                    disabled={resumingId !== null}
                    onClick={() => resume(session.id)}
                  >
                    {resumingId === session.id ? '불러오는 중…' : '이어서 하기'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {recentError && (
          <p className="muted small" role="alert">
            최근 세션을 불러오지 못했습니다.
          </p>
        )}
      </form>
    </div>
  )
}
