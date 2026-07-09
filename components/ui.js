'use client'

import { DIFFICULTIES } from '@/lib/quiz'

export function Loader({ label = 'Yuklanmoqda…' }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 14, padding: '30vh 0' }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: '2px solid var(--hairline-strong)',
          borderTopColor: 'var(--amber)',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span className="faint" style={{ fontSize: 13 }}>{label}</span>
    </div>
  )
}

export function ErrorState({ title = 'Xatolik', message, onRetry }) {
  return (
    <div className="card rise" style={{ marginTop: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>⚠️</div>
      <h2>{title}</h2>
      <p className="dim" style={{ fontSize: 14, marginTop: 8 }}>{message}</p>
      {onRetry && (
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={onRetry}>
          Qayta urinish
        </button>
      )}
    </div>
  )
}

export function Empty({ icon = '∅', title, hint }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 20px' }}>
      <div style={{ fontFamily: 'var(--display)', fontSize: 40, color: 'var(--text-faint)' }}>{icon}</div>
      <h2 style={{ marginTop: 12 }}>{title}</h2>
      {hint && <p className="faint" style={{ fontSize: 13.5, marginTop: 6 }}>{hint}</p>}
    </div>
  )
}

/** Telegram rasmi bo'lmasa — bosh harflardan iborat zaxira avatar. */
export function Avatar({ user, size = 54 }) {
  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || '?'
  const common = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    border: '1px solid var(--hairline-strong)',
  }

  if (user?.photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.photo_url} alt="" style={{ ...common, objectFit: 'cover' }} />
  }

  return (
    <div
      style={{
        ...common,
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(145deg, var(--ink-600), var(--ink-800))',
        fontFamily: 'var(--display)',
        fontSize: size * 0.38,
        color: 'var(--amber)',
      }}
    >
      {initials}
    </div>
  )
}

export function DifficultyChip({ level }) {
  if (!level) return null
  return <span className={`chip chip-${level}`}>{DIFFICULTIES[level] || level}</span>
}

export function StatTile({ label, value, tone = 'neutral', sub }) {
  const colors = { good: 'var(--green)', bad: 'var(--red)', warn: 'var(--amber)', neutral: 'var(--text)' }
  return (
    <div
      style={{
        background: 'var(--ink-800)',
        border: '1px solid var(--hairline)',
        borderRadius: 14,
        padding: '13px 14px',
      }}
    >
      <div className="eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--display)',
          fontSize: 25,
          fontWeight: 600,
          color: colors[tone],
          marginTop: 4,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

/** Ball halqasi — SVG dumaloq indikator. */
export function ScoreRing({ percent, size = 132 }) {
  const stroke = 9
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const color = percent >= 80 ? 'var(--green)' : percent >= 50 ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-600)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          style={{ transition: 'stroke-dashoffset 1.1s var(--tap)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--display)',
          fontSize: 34,
          fontWeight: 600,
          color,
        }}
      >
        {percent}
        <span style={{ fontSize: 15, marginTop: -6, color: 'var(--text-faint)' }}>%</span>
      </div>
    </div>
  )
}

export function ProgressBar({ value, max, color = 'var(--amber)' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 4, background: 'var(--ink-600)', borderRadius: 99, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 99,
          transition: 'width 0.35s var(--tap)',
        }}
      />
    </div>
  )
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('uz-UZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m} daq ${s % 60} son` : `${s} son`
}
