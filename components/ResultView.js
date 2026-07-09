'use client'

import { useState } from 'react'
import { DIFFICULTIES, QUESTION_TYPES } from '@/lib/quiz'
import { ScoreRing, StatTile, ProgressBar, DifficultyChip, formatDuration, formatDate } from './ui'
import { hapticTap } from '@/lib/haptics'

function verdict(percent) {
  if (percent >= 90) return { text: "A'lo natija", emoji: '🏆' }
  if (percent >= 75) return { text: 'Yaxshi natija', emoji: '✨' }
  if (percent >= 50) return { text: "O'rtacha natija", emoji: '📘' }
  return { text: 'Mashq kerak', emoji: '🌱' }
}

function Breakdown({ title, data, labels }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v.total > 0)
  if (entries.length === 0) return null

  return (
    <div style={{ marginTop: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {entries.map(([key, v]) => {
          const pct = Math.round((v.correct / v.total) * 100)
          const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ textTransform: 'capitalize' }}>{labels?.[key] || key}</span>
                <span className="faint">
                  {v.correct}/{v.total} · {pct}%
                </span>
              </div>
              <ProgressBar value={v.correct} max={v.total} color={color} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReviewItem({ item, index }) {
  const [open, setOpen] = useState(false)
  const ok = item.isCorrect
  const accent = ok ? 'var(--green)' : 'var(--red)'

  const answerText = (key) => {
    const opt = item.options?.find((o) => String(o.key).toLowerCase() === String(key).toLowerCase())
    return opt ? `${opt.key}. ${opt.text}` : key || '—'
  }

  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid var(--hairline)',
        borderLeft: `3px solid ${accent}`,
        background: 'var(--ink-800)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => {
          hapticTap()
          setOpen((o) => !o)
        }}
        style={{ display: 'flex', gap: 11, width: '100%', textAlign: 'left', padding: '13px 14px' }}
      >
        <span style={{ color: accent, fontWeight: 800, fontSize: 14, minWidth: 22 }}>
          {ok ? '✓' : '✕'}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="faint" style={{ fontSize: 11 }}>
            Savol {index + 1}
            {item.timedOut && ' · vaqt tugadi'}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 14,
              lineHeight: 1.45,
              marginTop: 2,
              ...(open ? {} : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
            }}
          >
            {item.question}
          </span>
        </span>
        <span className="faint" style={{ fontSize: 11, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          ▾
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px 47px', fontSize: 13.5 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <DifficultyChip level={item.difficulty} />
            {item.category && <span className="chip">{item.category}</span>}
          </div>

          {!ok && (
            <div style={{ marginBottom: 7 }}>
              <span className="faint">Sizning javobingiz: </span>
              <span style={{ color: 'var(--red)' }}>
                {item.givenAnswer ? answerText(item.givenAnswer) : 'javob berilmadi'}
              </span>
            </div>
          )}
          <div>
            <span className="faint">To'g'ri javob: </span>
            <span style={{ color: 'var(--green)' }}>{answerText(item.correctAnswer)}</span>
          </div>

          {item.explanation && (
            <p
              className="dim"
              style={{
                marginTop: 11,
                paddingTop: 11,
                borderTop: '1px solid var(--hairline)',
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {item.explanation}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Urinish tahlili. Foydalanuvchi test tugagach shuni ko'radi,
 * admin esa boshqa foydalanuvchi urinishini ochganda AYNAN shu komponentni ko'radi.
 */
export default function ResultView({ attempt, header = null, footer = null }) {
  const [filter, setFilter] = useState('all')
  const v = verdict(attempt.scorePercent)

  const filtered = attempt.review.filter((r) =>
    filter === 'all' ? true : filter === 'wrong' ? !r.isCorrect : r.isCorrect
  )

  return (
    <div>
      {header}

      <div className="rise" style={{ display: 'grid', placeItems: 'center', padding: '18px 0 22px' }}>
        <ScoreRing percent={attempt.scorePercent} />
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <h1 style={{ fontSize: 23 }}>
            {v.emoji} {v.text}
          </h1>
          <p className="faint" style={{ fontSize: 13, marginTop: 4 }}>
            {attempt.topicTitle} · {formatDate(attempt.finishedAt)}
          </p>
        </div>
      </div>

      <div className="rise" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, animationDelay: '90ms' }}>
        <StatTile label="To'g'ri" value={`${attempt.correctCount} / ${attempt.total}`} tone="good" />
        <StatTile label="Xato" value={attempt.wrongCount} tone={attempt.wrongCount ? 'bad' : 'neutral'} />
        <StatTile
          label="Sarflangan vaqt"
          value={formatDuration(attempt.durationSeconds ?? attempt.totalTimeSpent)}
          sub={`o'rtacha ${Math.round((attempt.totalTimeSpent || 0) / Math.max(1, attempt.total))} son/savol`}
        />
        <StatTile
          label="Vaqt tugagan"
          value={attempt.timedOutCount || 0}
          tone={attempt.timedOutCount ? 'warn' : 'neutral'}
          sub={attempt.skippedCount ? `${attempt.skippedCount} ta tashlab ketilgan` : undefined}
        />
      </div>

      <div className="card rise" style={{ marginTop: 12, animationDelay: '150ms' }}>
        <Breakdown title="Qiyinlik bo'yicha" data={attempt.byDifficulty} labels={DIFFICULTIES} />
        <Breakdown title="Savol turi bo'yicha" data={attempt.byType} labels={QUESTION_TYPES} />
        <Breakdown title="Bo'lim bo'yicha" data={attempt.byCategory} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '26px 0 12px' }}>
        <div className="eyebrow">Savollar tahlili</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[
            ['all', 'Hammasi'],
            ['wrong', 'Xato'],
            ['correct', "To'g'ri"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                hapticTap()
                setFilter(key)
              }}
              className="chip"
              style={
                filter === key
                  ? { background: 'var(--amber-soft)', color: 'var(--amber)', borderColor: 'var(--amber-line)' }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.map((item) => (
          <ReviewItem key={item.number} item={item} index={attempt.review.indexOf(item)} />
        ))}
        {filtered.length === 0 && (
          <p className="faint" style={{ textAlign: 'center', padding: 24, fontSize: 13.5 }}>
            Bu toifada savol yo'q.
          </p>
        )}
      </div>

      {footer}
    </div>
  )
}
