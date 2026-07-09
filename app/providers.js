'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '@/lib/api'

const TelegramContext = createContext({
  webApp: null,
  user: null,
  isAdmin: false,
  status: 'loading',
  error: null,
})

export function useTelegram() {
  return useContext(TelegramContext)
}

export function TelegramProvider({ children }) {
  const [state, setState] = useState({ webApp: null, user: null, isAdmin: false, status: 'loading', error: null })

  useEffect(() => {
    const tg = window.Telegram?.WebApp

    if (tg) {
      tg.ready()
      tg.expand()
      tg.setHeaderColor?.('#080a0f')
      tg.setBackgroundColor?.('#080a0f')
      tg.disableVerticalSwipes?.() // savol varaqlashda tasodifan yopilib ketmasin
    }

    let cancelled = false
    api('/me')
      .then((data) => {
        if (cancelled) return
        setState({
          webApp: tg || null,
          // photo_url initData'da bo'lmasligi mumkin — initDataUnsafe'dan to'ldiramiz
          user: { ...data.user, photo_url: data.user.photo_url || tg?.initDataUnsafe?.user?.photo_url || null },
          isAdmin: data.isAdmin,
          status: 'ready',
          error: null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState((s) => ({ ...s, webApp: tg || null, status: 'error', error: err }))
      })

    return () => {
      cancelled = true
    }
  }, [])

  return <TelegramContext.Provider value={state}>{children}</TelegramContext.Provider>
}

/**
 * Telegram'ning native "Orqaga" tugmasini boshqaradi.
 * handler null bo'lsa tugma yashiriladi.
 */
export function useBackButton(handler) {
  useEffect(() => {
    const bb = window.Telegram?.WebApp?.BackButton
    if (!bb) return

    if (!handler) {
      bb.hide()
      return
    }

    bb.show()
    bb.onClick(handler)
    return () => {
      bb.offClick(handler)
      bb.hide()
    }
  }, [handler])
}
