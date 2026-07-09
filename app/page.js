'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTelegram, useBackButton } from './providers'
import { api } from '@/lib/api'
import { hapticTap } from '@/lib/haptics'
import { Loader, ErrorState, Empty, Avatar } from '@/components/ui'

function ProfileCard({ user, isAdmin }) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return (
    <div className="rise" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '22px 0 20px' }}>
      <Avatar user={user} size={56} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <h2 style={{ fontSize: 19, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fullName || 'Foydalanuvchi'}
          </h2>
          {user.is_premium && <span title="Telegram Premium">⭐</span>}
        </div>
        <div className="faint" style={{ fontSize: 13 }}>
          {user.username ? `@${user.username}` : `ID ${user.id}`}
          {isAdmin && <span className="chip" style={{ marginLeft: 8, padding: '2px 7px', fontSize: 10 }}>ADMIN</span>}
        </div>
      </div>
    </div>
  )
}

function TopicCard({ topic, index }) {
  const minutes = Math.max(1, Math.round(topic.totalSeconds / 60))
  const order = ['easy', 'medium', 'hard']
  const labels = { easy: 'oson', medium: "o'rta", hard: 'qiyin' }

  return (
    <Link href={`/quiz/${topic.slug}`} onClick={() => hapticTap()}>
      <article
        className="card rise"
        style={{ animationDelay: `${60 + index * 55}ms`, position: 'relative', overflow: 'hidden' }}
      >
        {/* Fondagi katta raqam — jurnal uslubidagi bezak */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 12,
            top: -14,
            fontFamily: 'var(--display)',
            fontSize: 76,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.028)',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="eyebrow">Mavzu</div>
        <h2 style={{ marginTop: 6, fontSize: 21, paddingRight: 46 }}>{topic.title}</h2>

        {topic.description && (
          <p className="dim" style={{ fontSize: 13.5, marginTop: 7, lineHeight: 1.5 }}>
            {topic.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
          <span className="chip">{topic.questionCount} savol</span>
          <span className="chip">≈ {minutes} daq</span>
          {order
            .filter((d) => topic.difficulties[d])
            .map((d) => (
              <span key={d} className={`chip chip-${d}`}>
                {topic.difficulties[d]} {labels[d]}
              </span>
            ))}
        </div>
      </article>
    </Link>
  )
}

export default function HomePage() {
  const { user, isAdmin, status, error, retry } = useTelegram()
  const [topics, setTopics] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useBackButton(null)

  useEffect(() => {
    if (status !== 'ready') return
    api('/topics')
      .then((d) => setTopics(d.topics))
      .catch(setLoadError)
  }, [status])

  if (status === 'loading') return <Loader />
  if (status === 'error') {
    const denied = error?.status === 401
    return (
      <ErrorState
        title={denied ? 'Kirish rad etildi' : 'Ulanib bo\'lmadi'}
        message={
          denied
            ? "Ilovani Telegram bot orqali oching. Brauzerda sinash uchun .env faylda DEV_ALLOW_UNSAFE=1 qiling."
            : error?.message
        }
        onRetry={denied ? undefined : retry}
      />
    )
  }

  return (
    <main>
      <ProfileCard user={user} isAdmin={isAdmin} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        <Link href="/results" style={{ flex: 1 }} onClick={() => hapticTap()}>
          <button className="btn btn-ghost" style={{ minHeight: 46, fontSize: 14 }}>
            📊 Natijalarim
          </button>
        </Link>
        {isAdmin && (
          <Link href="/admin" style={{ flex: 1 }} onClick={() => hapticTap()}>
            <button className="btn btn-ghost" style={{ minHeight: 46, fontSize: 14 }}>
              ⚙️ Admin
            </button>
          </Link>
        )}
      </div>

      <div className="eyebrow" style={{ marginBottom: 12 }}>Testlar</div>

      {loadError && <ErrorState message={loadError.message} onRetry={() => location.reload()} />}
      {!topics && !loadError && <Loader label="Mavzular yuklanmoqda…" />}

      {topics?.length === 0 && (
        <Empty title="Hozircha mavzu yo'q" hint="Admin panel orqali birinchi testni yuklang." />
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {topics?.map((t, i) => (
          <TopicCard key={t.slug} topic={t} index={i} />
        ))}
      </div>
    </main>
  )
}
