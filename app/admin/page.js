'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBackButton, useTelegram } from '@/app/providers'
import { api } from '@/lib/api'
import { hapticTap, hapticError, hapticSuccess } from '@/lib/haptics'
import { Loader, ErrorState, Empty, Avatar, StatTile, formatDate } from '@/components/ui'
import UploadPanel from '@/components/admin/UploadPanel'
import TimersPanel from '@/components/admin/TimersPanel'

const TABS = [
  ['users', 'Foydalanuvchilar'],
  ['topics', 'Mavzular'],
  ['timers', 'Vaqt'],
]

function UserRow({ user }) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || `ID ${user.id}`
  const score = user.averageScore
  const color = score == null ? 'var(--text-faint)' : score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)'

  return (
    <Link href={`/admin/users/${user.id}`} onClick={() => hapticTap()}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 14,
          background: 'var(--ink-800)',
          border: '1px solid var(--hairline)',
        }}
      >
        <Avatar user={user} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
          <div className="faint" style={{ fontSize: 12 }}>
            {user.username ? `@${user.username}` : `ID ${user.id}`} · {user.attemptCount} urinish
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 17, fontWeight: 600, color }}>
            {score == null ? '—' : `${score}%`}
          </div>
          <div className="faint" style={{ fontSize: 10.5 }}>
            {user.lastAttemptAt ? formatDate(user.lastAttemptAt).split(',')[0] : 'test yo\'q'}
          </div>
        </div>
      </div>
    </Link>
  )
}

function UsersTab() {
  const [users, setUsers] = useState(null)

  useEffect(() => {
    api('/admin/users').then((d) => setUsers(d.users)).catch(() => setUsers([]))
  }, [])

  if (!users) return <Loader label="Foydalanuvchilar…" />
  if (users.length === 0) {
    return <Empty icon="◌" title="Foydalanuvchi yo'q" hint="Kimdir ilovani ochgach shu yerda paydo bo'ladi." />
  }

  const active = users.filter((u) => u.attemptCount > 0)
  const avg = active.length ? Math.round(active.reduce((s, u) => s + u.averageScore, 0) / active.length) : 0

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9, marginBottom: 18 }}>
        <StatTile label="Jami" value={users.length} />
        <StatTile label="Test yechgan" value={active.length} tone="good" />
        <StatTile label="O'rtacha ball" value={`${avg}%`} tone="warn" />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {users.map((u) => (
          <UserRow key={u.id} user={u} />
        ))}
      </div>
    </>
  )
}

function TopicsTab({ onChanged }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = useCallback(() => {
    api('/admin/topics').then(setData).catch(() => setData({ topics: [] }))
  }, [])

  useEffect(load, [load])

  const remove = async (slug) => {
    if (!confirm(`"${slug}" mavzusi va uning barcha savollari o'chiriladi. Davom etasizmi?`)) return
    setBusy(slug)
    try {
      await api(`/admin/topics/${slug}`, { method: 'DELETE' })
      hapticSuccess()
      load()
      onChanged?.()
    } catch (e) {
      hapticError()
      alert(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (!data) return <Loader label="Mavzular…" />

  return (
    <>
      <UploadPanel
        topics={data.topics}
        onDone={() => {
          load()
          onChanged?.()
        }}
      />

      <div className="eyebrow" style={{ margin: '26px 0 12px' }}>
        Mavjud mavzular ({data.topics.length})
      </div>

      {data.topics.length === 0 && <Empty icon="∅" title="Mavzu yo'q" hint="Yuqoridan JSON yuklang." />}

      <div style={{ display: 'grid', gap: 8 }}>
        {data.topics.map((t) => (
          <div key={t.slug} className="card" style={{ padding: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 17 }}>{t.title}</h2>
                <code className="faint" style={{ fontSize: 11.5 }}>quests/{t.slug}.json</code>
              </div>
              <button
                className="chip"
                disabled={busy === t.slug}
                onClick={() => remove(t.slug)}
                style={{ color: 'var(--red)', borderColor: 'var(--red-line)' }}
              >
                {busy === t.slug ? '…' : "O'chirish"}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 11, flexWrap: 'wrap' }}>
              <span className="chip">{t.questionCount} savol</span>
              {t.types.true_false && <span className="chip">{t.types.true_false} × T/F</span>}
              {t.types.multiple_choice && <span className="chip">{t.types.multiple_choice} × variantli</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const { status, isAdmin } = useTelegram()
  const [tab, setTab] = useState('users')
  const [version, setVersion] = useState(0)

  useBackButton(() => {
    hapticTap()
    router.push('/')
  })

  if (status === 'loading') return <Loader />
  if (status === 'error' || !isAdmin) {
    return (
      <ErrorState
        title="Ruxsat yo'q"
        message="Bu bo'lim faqat adminlar uchun. .env faylidagi ADMIN_IDS ro'yxatiga Telegram ID'ingizni qo'shing."
        onRetry={() => router.push('/')}
      />
    )
  }

  return (
    <main style={{ paddingTop: 24 }}>
      <button className="chip" onClick={() => router.push('/')} style={{ marginBottom: 18 }}>
        ← Bosh sahifa
      </button>

      <div className="eyebrow">Boshqaruv</div>
      <h1 style={{ marginTop: 6, marginBottom: 20 }}>Admin panel</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          gap: 4,
          padding: 4,
          background: 'var(--ink-800)',
          border: '1px solid var(--hairline)',
          borderRadius: 14,
          marginBottom: 22,
        }}
      >
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              hapticTap()
              setTab(key)
            }}
            style={{
              padding: '10px 6px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              background: tab === key ? 'var(--amber)' : 'transparent',
              color: tab === key ? '#1a1204' : 'var(--text-dim)',
              transition: 'background .16s, color .16s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div key={tab} className="rise">
        {tab === 'users' && <UsersTab />}
        {tab === 'topics' && <TopicsTab onChanged={() => setVersion((v) => v + 1)} />}
        {tab === 'timers' && <TimersPanel key={version} />}
      </div>
    </main>
  )
}
