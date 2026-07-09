'use client'

import { useRef, useState } from 'react'
import { api } from '@/lib/api'
import { slugify } from '@/lib/text'
import { hapticError, hapticSuccess, hapticTap } from '@/lib/haptics'

const SAMPLE = `{
  "title": "The Noun",
  "questions": [
    {
      "number": 1,
      "difficulty": "easy",
      "category": "theory",
      "type": "true_false",
      "question": "Otlar gapda ega vazifasida kelishi mumkin.",
      "answer": "True",
      "explanation": "Ha, otlar ko'pincha ega bo'lib keladi."
    },
    {
      "number": 2,
      "difficulty": "medium",
      "category": "theory",
      "type": "multiple_choice",
      "question": "Qaysi ot turi doim bosh harf bilan yoziladi?",
      "options": { "A": "Common", "B": "Proper", "C": "Abstract", "D": "Uncountable" },
      "answer": "B",
      "explanation": "Proper nouns har doim bosh harf bilan yoziladi."
    }
  ]
}`

function Note({ tone, children }) {
  const colors = {
    error: ['var(--red-soft)', 'var(--red-line)', 'var(--red)'],
    success: ['var(--green-soft)', 'var(--green-line)', 'var(--green)'],
  }[tone]
  return (
    <div
      style={{
        background: colors[0],
        border: `1px solid ${colors[1]}`,
        color: colors[2],
        borderRadius: 12,
        padding: '11px 13px',
        fontSize: 13,
        marginTop: 12,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}

/* ------------------------- JSON fayl / matn yuklash ----------------------- */

function JsonUpload({ onDone }) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [mode, setMode] = useState('replace')
  const [raw, setRaw] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const effectiveSlug = slug || slugify(title)

  const pickFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setRaw(text)
    if (!title) setTitle(file.name.replace(/\.json$/i, '').replace(/[-_]/g, ' '))
    if (!slug) setSlug(slugify(file.name.replace(/\.json$/i, '')))
  }

  const submit = async () => {
    setResult(null)

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      hapticError()
      return setResult({ tone: 'error', lines: [`JSON o'qib bo'lmadi: ${err.message}`] })
    }

    if (!effectiveSlug) {
      hapticError()
      return setResult({ tone: 'error', lines: ['Mavzu nomini kiriting.'] })
    }

    setBusy(true)
    try {
      const res = await api('/admin/topics', {
        method: 'POST',
        body: { slug: effectiveSlug, title: title || parsed.title, data: parsed, mode },
      })
      hapticSuccess()
      setResult({
        tone: 'success',
        lines: [
          `✓ quests/${res.slug}.json saqlandi — ${res.questionCount} ta savol${res.merged ? ' (qo\'shildi)' : ''}.`,
        ],
      })
      setRaw('')
      if (fileRef.current) fileRef.current.value = ''
      onDone?.()
    } catch (err) {
      hapticError()
      setResult({ tone: 'error', lines: err.payload?.errors || [err.message] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <label>Mavzu nomi</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Masalan: The Noun"
        />
        {effectiveSlug && (
          <p className="faint" style={{ fontSize: 11.5, marginTop: 5 }}>
            Fayl: <code>quests/{effectiveSlug}.json</code>
          </p>
        )}
      </div>

      <div>
        <label>Fayl nomi (ixtiyoriy)</label>
        <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder={slugify(title) || 'the-noun'} />
      </div>

      <div>
        <label>Agar mavzu allaqachon mavjud bo'lsa</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            ['replace', 'Almashtirish'],
            ['merge', "Savollarni qo'shish"],
          ].map(([key, label]) => (
            <button
              key={key}
              className="chip"
              onClick={() => {
                hapticTap()
                setMode(key)
              }}
              style={
                mode === key
                  ? { background: 'var(--amber-soft)', color: 'var(--amber)', borderColor: 'var(--amber-line)' }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label>JSON fayl</label>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={pickFile} style={{ padding: 10 }} />
      </div>

      <div>
        <label>… yoki JSON matnini joylashtiring</label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={9}
          spellCheck={false}
          placeholder={SAMPLE}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, lineHeight: 1.5, resize: 'vertical' }}
        />
      </div>

      <button className="btn btn-primary" onClick={submit} disabled={busy || !raw.trim()}>
        {busy ? 'Saqlanmoqda…' : 'Yuklash'}
      </button>

      {result && (
        <Note tone={result.tone}>
          {result.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </Note>
      )}
    </div>
  )
}

/* --------------------------- Bitta savol qo'shish ------------------------- */

const EMPTY_OPTIONS = { A: '', B: '', C: '', D: '' }

function QuestionForm({ topics, onDone }) {
  const [slug, setSlug] = useState(topics[0]?.slug || '')
  const [type, setType] = useState('multiple_choice')
  const [difficulty, setDifficulty] = useState('medium')
  const [category, setCategory] = useState('theory')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(EMPTY_OPTIONS)
  const [answer, setAnswer] = useState('A')
  const [explanation, setExplanation] = useState('')
  const [timeLimit, setTimeLimit] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const switchType = (t) => {
    hapticTap()
    setType(t)
    setAnswer(t === 'true_false' ? 'True' : 'A')
  }

  const submit = async () => {
    setResult(null)
    if (!slug) return setResult({ tone: 'error', lines: ['Avval mavzu tanlang.'] })

    const payload = {
      type,
      difficulty,
      category: category || undefined,
      question: question.trim(),
      answer,
      explanation: explanation.trim() || undefined,
      ...(type === 'multiple_choice'
        ? { options: Object.fromEntries(Object.entries(options).filter(([, v]) => v.trim())) }
        : {}),
      ...(timeLimit ? { time_limit: Number(timeLimit) } : {}),
    }

    setBusy(true)
    try {
      const res = await api(`/admin/topics/${slug}/questions`, { method: 'POST', body: { question: payload } })
      hapticSuccess()
      setResult({ tone: 'success', lines: [`✓ Savol #${res.number} qo'shildi. Jami: ${res.questionCount}.`] })
      setQuestion('')
      setOptions(EMPTY_OPTIONS)
      setExplanation('')
      onDone?.()
    } catch (err) {
      hapticError()
      setResult({ tone: 'error', lines: err.payload?.errors || [err.message] })
    } finally {
      setBusy(false)
    }
  }

  if (topics.length === 0) {
    return (
      <p className="faint" style={{ fontSize: 13.5, textAlign: 'center', padding: 20 }}>
        Savol qo'shish uchun avval JSON orqali mavzu yarating.
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <label>Mavzu</label>
        <select value={slug} onChange={(e) => setSlug(e.target.value)}>
          {topics.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.title} ({t.questionCount})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Savol turi</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            ['multiple_choice', 'Variantli'],
            ['true_false', "To'g'ri / Noto'g'ri"],
          ].map(([key, label]) => (
            <button
              key={key}
              className="chip"
              onClick={() => switchType(key)}
              style={
                type === key
                  ? { background: 'var(--amber-soft)', color: 'var(--amber)', borderColor: 'var(--amber-line)' }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label>Qiyinlik</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="easy">Oson</option>
            <option value="medium">O'rtacha</option>
            <option value="hard">Qiyin</option>
          </select>
        </div>
        <div>
          <label>Bo'lim</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="theory" />
        </div>
      </div>

      <div>
        <label>Savol matni</label>
        <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} style={{ resize: 'vertical' }} />
      </div>

      {type === 'multiple_choice' ? (
        <div>
          <label>Variantlar</label>
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.keys(EMPTY_OPTIONS).map((key) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <button
                  onClick={() => {
                    hapticTap()
                    setAnswer(key)
                  }}
                  title="To'g'ri javob sifatida belgilash"
                  style={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 9,
                    fontFamily: 'var(--display)',
                    fontWeight: 600,
                    background: answer === key ? 'var(--green-soft)' : 'var(--ink-600)',
                    border: `1px solid ${answer === key ? 'var(--green-line)' : 'var(--hairline)'}`,
                    color: answer === key ? 'var(--green)' : 'var(--text-dim)',
                  }}
                >
                  {key}
                </button>
                <input
                  value={options[key]}
                  onChange={(e) => setOptions((o) => ({ ...o, [key]: e.target.value }))}
                  placeholder={`${key} varianti`}
                />
              </div>
            ))}
          </div>
          <p className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
            Harfni bosib to'g'ri javobni belgilang. Bo'sh variantlar saqlanmaydi.
          </p>
        </div>
      ) : (
        <div>
          <label>To'g'ri javob</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['True', 'False'].map((v) => (
              <button
                key={v}
                className="chip"
                onClick={() => {
                  hapticTap()
                  setAnswer(v)
                }}
                style={
                  answer === v
                    ? { background: 'var(--green-soft)', color: 'var(--green)', borderColor: 'var(--green-line)' }
                    : undefined
                }
              >
                {v === 'True' ? "To'g'ri" : "Noto'g'ri"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label>Izoh (javobdan keyin ko'rsatiladi)</label>
        <textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} style={{ resize: 'vertical' }} />
      </div>

      <div>
        <label>Shu savol uchun vaqt, soniya (ixtiyoriy)</label>
        <input
          type="number"
          min="5"
          max="600"
          value={timeLimit}
          onChange={(e) => setTimeLimit(e.target.value)}
          placeholder="Bo'sh qoldirilsa — mavzu sozlamasi ishlaydi"
        />
      </div>

      <button className="btn btn-primary" onClick={submit} disabled={busy || !question.trim()}>
        {busy ? 'Saqlanmoqda…' : "Savolni qo'shish"}
      </button>

      {result && (
        <Note tone={result.tone}>
          {result.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </Note>
      )}
    </div>
  )
}

/* --------------------------------- Panel ---------------------------------- */

export default function UploadPanel({ topics, onDone }) {
  const [mode, setMode] = useState('json')

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[
          ['json', '📁 JSON yuklash'],
          ['single', "➕ Savol qo'shish"],
        ].map(([key, label]) => (
          <button
            key={key}
            className="chip"
            onClick={() => {
              hapticTap()
              setMode(key)
            }}
            style={
              mode === key
                ? { background: 'var(--amber-soft)', color: 'var(--amber)', borderColor: 'var(--amber-line)' }
                : undefined
            }
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'json' ? <JsonUpload onDone={onDone} /> : <QuestionForm topics={topics} onDone={onDone} />}
    </div>
  )
}
