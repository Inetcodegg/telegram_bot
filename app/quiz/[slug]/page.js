'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useBackButton, useTelegram } from '@/app/providers'
import { api } from '@/lib/api'
import { cacheAttempts } from '@/lib/cloud'
import { hapticError, hapticSuccess, hapticTap, hapticWarning, hapticSelection } from '@/lib/haptics'
import { QUESTION_TYPES } from '@/lib/quiz'
import { Loader, ErrorState, DifficultyChip, ProgressBar, formatDuration } from '@/components/ui'
import ResultView from '@/components/ResultView'

const PRAISE = ['Barakalla', "To'g'ri", 'Zo\'r', 'Ajoyib']

/* --------------------------------- Toast ---------------------------------- */
/* Bezovta qilmaydigan, kichkina va qisqa umrli tabrik. */
function Praise({ token }) {
  const [visible, setVisible] = useState(false)
  const [word, setWord] = useState(PRAISE[0])

  useEffect(() => {
    if (!token) return
    setWord(PRAISE[Math.floor(Math.random() * PRAISE.length)])
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 1100)
    return () => clearTimeout(t)
  }, [token])

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'calc(12px + env(safe-area-inset-top, 0px))',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '-14px'}) scale(${visible ? 1 : 0.92})`,
        opacity: visible ? 1 : 0,
        transition: 'all .28s var(--tap)',
        pointerEvents: 'none',
        zIndex: 50,
        background: 'var(--green-soft)',
        border: '1px solid var(--green-line)',
        backdropFilter: 'blur(10px)',
        color: 'var(--green)',
        padding: '6px 13px',
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 700,
      }}
    >
      ✓ {word}
    </div>
  )
}

/* --------------------------------- Taymer --------------------------------- */

function Timer({ remaining, limit }) {
  const low = remaining <= 5
  const pct = limit ? (remaining / limit) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span
        style={{
          fontFamily: 'var(--display)',
          fontSize: 14,
          fontWeight: 600,
          color: low ? 'var(--red)' : 'var(--text-dim)',
          minWidth: 26,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {remaining}
      </span>
      <div style={{ width: 54 }}>
        <ProgressBar value={pct} max={100} color={low ? 'var(--red)' : 'var(--amber)'} />
      </div>
    </div>
  )
}

/* --------------------------------- Variant -------------------------------- */

function Option({ option, index, state, disabled, onSelect }) {
  const palette = {
    idle: { bg: 'var(--ink-800)', border: 'var(--hairline)', fg: 'var(--text)', badge: 'var(--ink-600)' },
    correct: { bg: 'var(--green-soft)', border: 'var(--green-line)', fg: 'var(--green)', badge: 'var(--green-line)' },
    wrong: { bg: 'var(--red-soft)', border: 'var(--red-line)', fg: 'var(--red)', badge: 'var(--red-line)' },
    muted: { bg: 'var(--ink-850)', border: 'var(--hairline)', fg: 'var(--text-faint)', badge: 'var(--ink-700)' },
  }[state]

  return (
    <button
      disabled={disabled}
      onClick={() => onSelect(option.key)}
      className={state === 'wrong' ? 'shake' : ''}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '14px 15px',
        borderRadius: 14,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        transition: 'background .18s, border-color .18s, transform .12s var(--tap)',
        animation: `rise .35s var(--tap) both ${index * 45}ms`,
        cursor: disabled ? 'default' : 'pointer',
      }}
      onPointerDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(0.985)')}
      onPointerUp={(e) => (e.currentTarget.style.transform = '')}
      onPointerLeave={(e) => (e.currentTarget.style.transform = '')}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 9,
          background: palette.badge,
          fontFamily: 'var(--display)',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {option.key.length > 1 ? (state === 'correct' ? '✓' : '·') : option.key}
      </span>
      <span style={{ fontSize: 15, lineHeight: 1.45 }}>{option.text}</span>
    </button>
  )
}

/* ================================== Sahifa ================================= */

export default function QuizPage() {
  const { slug } = useParams()
  const router = useRouter()
  const { status } = useTelegram()

  const [topic, setTopic] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [phase, setPhase] = useState('intro') // intro | running | done
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({}) // { [number]: {answer,timeSpent,timedOut,correct,correctAnswer,explanation} }
  const [remaining, setRemaining] = useState(0)
  const [praiseToken, setPraiseToken] = useState(0)
  const [attempt, setAttempt] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const startedAtRef = useRef(null)
  const remainingRef = useRef({}) // savol raqami -> qolgan soniya (orqaga qaytganda saqlanadi)
  const checkingRef = useRef(false)

  const questions = topic?.questions || []
  const current = questions[idx] || null
  const currentAnswer = current ? answers[current.number] : null

  /* ------------------------------- Yuklash -------------------------------- */
  useEffect(() => {
    if (status !== 'ready') return
    api(`/topics/${slug}`)
      .then((d) => {
        setTopic(d)
        d.questions.forEach((q) => (remainingRef.current[q.number] = q.timeLimit))
      })
      .catch(setLoadError)
  }, [status, slug])

  /* ---------------------- Javobni tekshirish (serverda) ------------------- */
  const revealAnswer = useCallback(
    async (question, given, timedOut) => {
      if (checkingRef.current || answers[question.number]) return
      checkingRef.current = true

      const timeSpent = question.timeLimit - (remainingRef.current[question.number] ?? 0)

      try {
        const res = await api('/quiz/check', {
          method: 'POST',
          body: { topic: slug, number: question.number, answer: given },
        })

        setAnswers((prev) => ({
          ...prev,
          [question.number]: {
            answer: given,
            timedOut,
            timeSpent,
            correct: res.correct,
            correctAnswer: res.correctAnswer,
            explanation: res.explanation,
          },
        }))

        if (timedOut) hapticWarning()
        else if (res.correct) {
          hapticSuccess()
          setPraiseToken((t) => t + 1)
        } else hapticError()
      } catch (err) {
        setLoadError(err)
      } finally {
        checkingRef.current = false
      }
    },
    [answers, slug]
  )

  /* -------------------------------- Taymer -------------------------------- */
  useEffect(() => {
    if (phase !== 'running' || !current) return

    // Javob berilgan savolda taymer ishlamaydi.
    if (answers[current.number]) {
      setRemaining(remainingRef.current[current.number] ?? 0)
      return
    }

    setRemaining(remainingRef.current[current.number] ?? current.timeLimit)

    const id = setInterval(() => {
      const left = (remainingRef.current[current.number] ?? current.timeLimit) - 1
      remainingRef.current[current.number] = Math.max(0, left)
      setRemaining(Math.max(0, left))

      if (left <= 0) {
        clearInterval(id)
        revealAnswer(current, null, true)
      }
    }, 1000)

    return () => clearInterval(id)
  }, [phase, current, answers, revealAnswer])

  /* --------------------------- Orqaga qaytish ----------------------------- */
  const goBack = useCallback(() => {
    hapticTap()
    if (phase === 'done') return router.push('/')
    if (phase === 'intro') return router.push('/')
    if (idx > 0) return setIdx((i) => i - 1)
    setPhase('intro')
  }, [phase, idx, router])

  useBackButton(goBack)

  /* -------------------------------- Amallar ------------------------------- */
  const start = () => {
    hapticTap('medium')
    startedAtRef.current = Date.now()
    setPhase('running')
  }

  const select = (key) => {
    if (currentAnswer) return
    hapticSelection()
    revealAnswer(current, key, false)
  }

  const next = () => {
    hapticTap()
    if (idx < questions.length - 1) setIdx((i) => i + 1)
  }

  const finish = async () => {
    if (submitting) return
    setSubmitting(true)
    hapticTap('medium')

    const payload = Object.entries(answers).map(([number, a]) => ({
      number: Number(number),
      answer: a.answer,
      timeSpent: a.timeSpent,
      timedOut: a.timedOut,
    }))

    try {
      const { attempt } = await api('/attempts', {
        method: 'POST',
        body: { topic: slug, startedAt: startedAtRef.current, answers: payload },
      })
      setAttempt(attempt)
      setPhase('done')
      window.scrollTo({ top: 0 })

      // Telegram CloudStorage'ga yengil kesh (server asosiy manba bo'lib qoladi).
      api('/attempts')
        .then((d) => cacheAttempts(d.attempts))
        .catch(() => {})
    } catch (err) {
      setLoadError(err)
    } finally {
      setSubmitting(false)
    }
  }

  /* -------------------------------- Ko'rinish ----------------------------- */

  if (status === 'loading' || (!topic && !loadError)) return <Loader />
  if (loadError) {
    return (
      <ErrorState
        message={loadError.status === 404 ? 'Bunday mavzu topilmadi.' : loadError.message}
        onRetry={() => router.push('/')}
      />
    )
  }

  /* --------- 1. Qo'llanma ekrani --------- */
  if (phase === 'intro') {
    const minutes = Math.max(1, Math.round(topic.totalSeconds / 60))
    const rules = [
      ['🎯', `${topic.questionCount} ta savol, har biri bittalab chiqadi`],
      ['⏱', `Har bir savolga alohida vaqt beriladi (jami ≈ ${minutes} daqiqa)`],
      ['📳', "To'g'ri javobda yashil, xatoda qizil titrash beriladi"],
      ['↩️', 'Oldingi savollarga qaytib ko\'rishingiz mumkin, lekin javobni o\'zgartira olmaysiz'],
      ['📊', 'Test oxirida to\'liq tahlil va izohlar ko\'rsatiladi'],
    ]

    return (
      <main style={{ paddingTop: 26 }}>
        <button className="chip rise" onClick={goBack} style={{ marginBottom: 18 }}>
          ← Ortga
        </button>

        <div className="eyebrow rise">Qo'llanma</div>
        <h1 className="rise" style={{ marginTop: 8, animationDelay: '50ms' }}>
          {topic.title}
        </h1>
        {topic.description && (
          <p className="dim rise" style={{ fontSize: 14.5, marginTop: 10, animationDelay: '90ms' }}>
            {topic.description}
          </p>
        )}

        <div className="card rise" style={{ marginTop: 22, animationDelay: '130ms' }}>
          <div style={{ display: 'grid', gap: 14 }}>
            {rules.map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, lineHeight: 1.4 }}>{icon}</span>
                <span style={{ fontSize: 14, lineHeight: 1.5 }} className="dim">
                  {text}
                </span>
              </div>
            ))}
          </div>

          {topic.instructions && (
            <>
              <hr className="hairline" />
              <p className="dim" style={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>
                {topic.instructions}
              </p>
            </>
          )}
        </div>

        <div style={{ position: 'sticky', bottom: 'calc(16px + var(--safe-b))', marginTop: 24 }}>
          <button className="btn btn-primary rise" style={{ animationDelay: '190ms' }} onClick={start}>
            Testni boshlash →
          </button>
        </div>
      </main>
    )
  }

  /* --------- 3. Natija ekrani --------- */
  if (phase === 'done' && attempt) {
    return (
      <main style={{ paddingTop: 22 }}>
        <ResultView
          attempt={attempt}
          footer={
            <div style={{ display: 'grid', gap: 9, marginTop: 26 }}>
              <button className="btn btn-primary" onClick={() => router.push('/')}>
                Bosh sahifaga
              </button>
              <button className="btn btn-ghost" onClick={() => router.push('/results')}>
                Barcha natijalarim
              </button>
            </div>
          }
        />
      </main>
    )
  }

  /* --------- 2. Savol ekrani --------- */
  const isLast = idx === questions.length - 1
  const optionState = (key) => {
    if (!currentAnswer) return 'idle'
    const isThis = String(key).toLowerCase() === String(currentAnswer.answer).toLowerCase()
    const isRight = String(key).toLowerCase() === String(currentAnswer.correctAnswer).toLowerCase()
    if (isRight) return 'correct'
    if (isThis) return 'wrong'
    return 'muted'
  }

  return (
    <main style={{ paddingTop: 18, paddingBottom: 120 }}>
      <Praise token={praiseToken} />

      {/* Sarlavha: ortga, hisob, taymer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button className="chip" onClick={goBack} aria-label="Ortga">
          ←
        </button>
        <span className="faint" style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
          {idx + 1} / {questions.length}
        </span>
        {currentAnswer ? (
          <span className="chip" style={{ opacity: 0.6 }}>
            {formatDuration(currentAnswer.timeSpent)}
          </span>
        ) : (
          <Timer remaining={remaining} limit={current.timeLimit} />
        )}
      </div>

      <div style={{ margin: '14px 0 22px' }}>
        <ProgressBar value={idx + (currentAnswer ? 1 : 0)} max={questions.length} />
      </div>

      {/* Savol */}
      <div key={current.number} className="rise">
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <DifficultyChip level={current.difficulty} />
          <span className="chip">{QUESTION_TYPES[current.type]}</span>
          {current.category && <span className="chip">{current.category}</span>}
        </div>

        <h1
          style={{
            fontSize: 21,
            lineHeight: 1.35,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            marginBottom: 22,
          }}
        >
          {current.question}
        </h1>

        <div style={{ display: 'grid', gap: 9 }}>
          {current.options.map((opt, i) => (
            <Option
              key={opt.key}
              option={opt}
              index={i}
              state={optionState(opt.key)}
              disabled={Boolean(currentAnswer)}
              onSelect={select}
            />
          ))}
        </div>

        {/* Izoh — faqat javobdan keyin */}
        {currentAnswer?.explanation && (
          <div
            className="rise"
            style={{
              marginTop: 16,
              padding: '14px 15px',
              borderRadius: 14,
              background: 'var(--ink-800)',
              border: '1px solid var(--hairline)',
              borderLeft: `3px solid ${currentAnswer.correct ? 'var(--green)' : 'var(--red)'}`,
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {currentAnswer.timedOut ? 'Vaqt tugadi' : currentAnswer.correct ? "To'g'ri" : 'Izoh'}
            </div>
            <p className="dim" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              {currentAnswer.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Pastki harakat paneli */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: `14px 18px calc(14px + var(--safe-b))`,
          background: 'linear-gradient(to top, var(--ink-900) 62%, transparent)',
          zIndex: 20,
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {!currentAnswer ? (
            <p className="faint" style={{ textAlign: 'center', fontSize: 12.5, margin: 0, minHeight: 54, lineHeight: '54px' }}>
              Javobni tanlang
            </p>
          ) : isLast ? (
            <button className="btn btn-primary" onClick={finish} disabled={submitting}>
              {submitting ? 'Hisoblanmoqda…' : 'Yakunlash va tahlilni ko\'rish'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={next}>
              Keyingi savol →
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
