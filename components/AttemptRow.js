'use client'

import { hapticTap } from '@/lib/haptics'
import { formatDate } from './ui'

/** Urinishlar ro'yxatidagi bitta qator. Natijalar sahifasi va admin panelda ishlatiladi. */
export default function AttemptRow({ attempt, onClick }) {
  const pct = attempt.scorePercent
  const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
  // Oflayn keshdagi yozuvlarda `review` bo'lmaydi — ularni ochib bo'lmaydi.
  const clickable = Boolean(onClick) && Array.isArray(attempt.review)

  return (
    <button
      disabled={!clickable}
      onClick={() => {
        hapticTap()
        onClick?.(attempt)
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        width: '100%',
        textAlign: 'left',
        padding: '13px 15px',
        borderRadius: 14,
        background: 'var(--ink-800)',
        border: '1px solid var(--hairline)',
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 46,
          height: 46,
          flexShrink: 0,
          borderRadius: 12,
          border: `1.5px solid ${color}`,
          color,
          fontFamily: 'var(--display)',
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        {pct}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {attempt.topicTitle}
        </div>
        <div className="faint" style={{ fontSize: 12 }}>
          {attempt.correctCount}/{attempt.total} to'g'ri · {formatDate(attempt.finishedAt)}
        </div>
      </div>

      {clickable && <span className="faint" style={{ fontSize: 12 }}>›</span>}
    </button>
  )
}
