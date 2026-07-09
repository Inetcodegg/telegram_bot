'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBackButton, useTelegram } from '@/app/providers'
import { api } from '@/lib/api'
import { readCachedAttempts, cacheAttempts } from '@/lib/cloud'
import { hapticTap } from '@/lib/haptics'
import { Loader, Empty, StatTile } from '@/components/ui'
import AttemptRow from '@/components/AttemptRow'
import ResultView from '@/components/ResultView'

export default function ResultsPage() {
  const router = useRouter()
  const { status } = useTelegram()
  const [attempts, setAttempts] = useState(null)
  const [selected, setSelected] = useState(null)

  useBackButton(() => {
    hapticTap()
    if (selected) setSelected(null)
    else router.push('/')
  })

  useEffect(() => {
    if (status !== 'ready') return

    // Avval CloudStorage keshi — ekran bo'sh turmasin.
    readCachedAttempts().then((cached) => {
      setAttempts((prev) => prev ?? (cached.length ? cached : null))
    })

    api('/attempts')
      .then((d) => {
        setAttempts(d.attempts)
        cacheAttempts(d.attempts)
      })
      .catch(() => setAttempts((prev) => prev ?? []))
  }, [status])

  if (status === 'loading' || !attempts) return <Loader />

  if (selected) {
    return (
      <main style={{ paddingTop: 20 }}>
        <button className="chip" onClick={() => setSelected(null)} style={{ marginBottom: 6 }}>
          ← Ro'yxatga
        </button>
        <ResultView attempt={selected} />
      </main>
    )
  }

  const best = attempts.length ? Math.max(...attempts.map((a) => a.scorePercent)) : 0
  const avg = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.scorePercent, 0) / attempts.length)
    : 0

  return (
    <main style={{ paddingTop: 24 }}>
      <button className="chip" onClick={() => router.push('/')} style={{ marginBottom: 18 }}>
        ← Bosh sahifa
      </button>

      <div className="eyebrow">Tarix</div>
      <h1 style={{ marginTop: 6 }}>Natijalarim</h1>

      {attempts.length === 0 ? (
        <Empty title="Hali test yechilmagan" hint="Bosh sahifadan mavzu tanlab boshlang." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9, margin: '18px 0 24px' }}>
            <StatTile label="Urinish" value={attempts.length} />
            <StatTile label="Eng yaxshi" value={`${best}%`} tone="good" />
            <StatTile label="O'rtacha" value={`${avg}%`} tone={avg >= 50 ? 'warn' : 'bad'} />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {attempts.map((a) => (
              <AttemptRow key={a.id} attempt={a} onClick={setSelected} />
            ))}
          </div>

          {attempts[0]?.cached && (
            <p className="faint" style={{ fontSize: 12, textAlign: 'center', marginTop: 16 }}>
              Oflayn kesh ko'rsatilmoqda — batafsil tahlil uchun internetga ulaning.
            </p>
          )}
        </>
      )}
    </main>
  )
}
