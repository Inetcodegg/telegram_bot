'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useBackButton, useTelegram } from '@/app/providers'
import { api } from '@/lib/api'
import { hapticTap } from '@/lib/haptics'
import { Loader, ErrorState, Empty, Avatar, StatTile, formatDate } from '@/components/ui'
import AttemptRow from '@/components/AttemptRow'
import ResultView from '@/components/ResultView'

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, padding: '7px 0' }}>
      <span className="faint">{label}</span>
      <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>{value ?? '—'}</span>
    </div>
  )
}

export default function AdminUserPage() {
  const { id } = useParams()
  const router = useRouter()
  const { status, isAdmin } = useTelegram()

  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  useBackButton(() => {
    hapticTap()
    if (selected) setSelected(null)
    else router.push('/admin')
  })

  useEffect(() => {
    if (status !== 'ready' || !isAdmin) return
    api(`/admin/users/${id}`).then(setData).catch(setError)
  }, [status, isAdmin, id])

  if (status === 'loading') return <Loader />
  if (!isAdmin) return <ErrorState title="Ruxsat yo'q" message="Faqat adminlar uchun." onRetry={() => router.push('/')} />
  if (error) return <ErrorState message={error.message} onRetry={() => router.push('/admin')} />
  if (!data) return <Loader />

  const { user, attempts } = data
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || `ID ${user.id}`

  // Admin foydalanuvchi ko'rgan aynan o'sha tahlil ekranini ochadi.
  if (selected) {
    return (
      <main style={{ paddingTop: 20 }}>
        <button className="chip" onClick={() => setSelected(null)} style={{ marginBottom: 6 }}>
          ← {name}
        </button>
        <ResultView attempt={selected} />
      </main>
    )
  }

  const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.scorePercent, 0) / attempts.length) : 0
  const best = attempts.length ? Math.max(...attempts.map((a) => a.scorePercent)) : 0

  return (
    <main style={{ paddingTop: 24 }}>
      <button className="chip" onClick={() => router.push('/admin')} style={{ marginBottom: 20 }}>
        ← Admin panel
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar user={user} size={62} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22 }}>{name}</h1>
          <p className="faint" style={{ fontSize: 13 }}>{user.username ? `@${user.username}` : `ID ${user.id}`}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Telegram profili</div>
        <Field label="ID" value={user.id} />
        <Field label="Ism" value={user.first_name} />
        <Field label="Familiya" value={user.last_name} />
        <Field label="Username" value={user.username ? `@${user.username}` : null} />
        <Field label="Til" value={user.language_code} />
        <Field label="Premium" value={user.is_premium ? 'Ha' : "Yo'q"} />
        <Field label="Birinchi kirish" value={formatDate(user.first_seen_at)} />
        <Field label="Oxirgi kirish" value={formatDate(user.last_seen_at)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9, margin: '16px 0 24px' }}>
        <StatTile label="Urinish" value={attempts.length} />
        <StatTile label="Eng yaxshi" value={`${best}%`} tone="good" />
        <StatTile label="O'rtacha" value={`${avg}%`} tone={avg >= 50 ? 'warn' : 'bad'} />
      </div>

      <div className="eyebrow" style={{ marginBottom: 12 }}>Urinishlar</div>

      {attempts.length === 0 ? (
        <Empty icon="◌" title="Test yechilmagan" />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {attempts.map((a) => (
            <AttemptRow key={a.id} attempt={a} onClick={setSelected} />
          ))}
        </div>
      )}
    </main>
  )
}
