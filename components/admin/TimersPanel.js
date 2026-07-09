'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { hapticError, hapticSuccess } from '@/lib/haptics'
import { QUESTION_TYPES } from '@/lib/quiz'
import { Loader } from '@/components/ui'

const TYPES = Object.keys(QUESTION_TYPES)

function NumberField({ label, value, placeholder, onChange }) {
  return (
    <div>
      <label>{label}</label>
      <input
        type="number"
        min="5"
        max="3600"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/**
 * Vaqt ustuvorligi:
 * savoldagi time_limit → mavzu+tur → mavzu standarti → global tur → global standart.
 */
export default function TimersPanel() {
  const [settings, setSettings] = useState(null)
  const [topics, setTopics] = useState([])
  const [draft, setDraft] = useState({ globalTimers: {}, defaultTimer: '', topics: {} })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api('/admin/topics').then((d) => {
      setTopics(d.topics)
      setSettings(d.settings)
      setDraft({
        globalTimers: { ...d.settings.globalTimers },
        defaultTimer: d.settings.defaultTimer,
        topics: Object.fromEntries(
          d.topics.map((t) => [
            t.slug,
            {
              timers: { ...(d.settings.topics?.[t.slug]?.timers || {}) },
              defaultTimer: d.settings.topics?.[t.slug]?.defaultTimer ?? '',
            },
          ])
        ),
      })
    })
  }, [])

  const save = async () => {
    setBusy(true)
    setSaved(false)
    try {
      const { settings } = await api('/admin/settings', { method: 'PUT', body: draft })
      setSettings(settings)
      hapticSuccess()
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (e) {
      hapticError()
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return <Loader label="Sozlamalar…" />

  const setTopicTimer = (slug, type, value) =>
    setDraft((d) => ({
      ...d,
      topics: { ...d.topics, [slug]: { ...d.topics[slug], timers: { ...d.topics[slug].timers, [type]: value } } },
    }))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div className="eyebrow">Global standart</div>
        <p className="faint" style={{ fontSize: 12.5, margin: '6px 0 16px' }}>
          Mavzuda alohida qiymat berilmagan barcha savollarga shu vaqt (soniya) qo'llanadi.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {TYPES.map((type) => (
            <NumberField
              key={type}
              label={QUESTION_TYPES[type]}
              value={draft.globalTimers[type]}
              onChange={(v) => setDraft((d) => ({ ...d, globalTimers: { ...d.globalTimers, [type]: v } }))}
            />
          ))}
          <NumberField
            label="Boshqa turlar uchun standart"
            value={draft.defaultTimer}
            onChange={(v) => setDraft((d) => ({ ...d, defaultTimer: v }))}
          />
        </div>
      </div>

      <div className="eyebrow">Mavzu bo'yicha</div>

      {topics.map((t) => (
        <div key={t.slug} className="card">
          <h2 style={{ fontSize: 16 }}>{t.title}</h2>
          <code className="faint" style={{ fontSize: 11 }}>{t.slug}</code>

          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            {TYPES.map((type) => (
              <NumberField
                key={type}
                label={`${QUESTION_TYPES[type]} ${t.types[type] ? `(${t.types[type]} ta)` : ''}`}
                value={draft.topics[t.slug]?.timers?.[type] ?? ''}
                placeholder={`Global: ${draft.globalTimers[type] || settings.defaultTimer} son`}
                onChange={(v) => setTopicTimer(t.slug, type, v)}
              />
            ))}
          </div>
          <p className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>
            Bo'sh qoldirsangiz global qiymat ishlatiladi.
          </p>
        </div>
      ))}

      <div style={{ position: 'sticky', bottom: 'calc(14px + var(--safe-b))' }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saqlanmoqda…' : saved ? '✓ Saqlandi' : 'Sozlamalarni saqlash'}
        </button>
      </div>
    </div>
  )
}
