'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '@/lib/api'

const TelegramContext = createContext({
  webApp: null,
  user: null,
  isAdmin: false,
  status: 'loading',
  error: null,
  retry: () => {},
})

export function useTelegram() {
  return useContext(TelegramContext)
}

const SDK_POLL_MS = 50

/**
 * Telegram ilovasi mini app'ni ochganda URL'ga `tgWebAppData` qo'shadi va
 * webview proxy'sini in'ektsiya qiladi. Shu belgilar bo'yicha muhitni ajratamiz:
 * Telegram ichida SDK'ni uzoqroq kutamiz, oddiy brauzerda esa deyarli kutmaymiz.
 */
function isTelegramEnv() {
  return (
    !!window.Telegram ||
    !!window.TelegramWebviewProxy ||
    window.location.hash.includes('tgWebAppData') ||
    window.location.search.includes('tgWebAppData')
  )
}

/** SDK'ni kutadi, lekin hech qachon abadiy osilib qolmaydi: timeout'da null qaytaradi. */
function waitForWebApp(signal) {
  const limit = isTelegramEnv() ? 12000 : 1500

  return new Promise((resolve) => {
    if (window.Telegram?.WebApp) return resolve(window.Telegram.WebApp)

    const started = Date.now()
    const done = () => {
      clearInterval(timer)
      resolve(window.Telegram?.WebApp || null)
    }
    const timer = setInterval(() => {
      if (window.Telegram?.WebApp || Date.now() - started >= limit) done()
    }, SDK_POLL_MS)

    signal.addEventListener('abort', done, { once: true })
  })
}

export function TelegramProvider({ children }) {
  const [state, setState] = useState({ webApp: null, user: null, isAdmin: false, status: 'loading', error: null })
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading', error: null }))
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    ;(async () => {
      const inTelegram = isTelegramEnv()
      const tg = await waitForWebApp(controller.signal)
      if (controller.signal.aborted) return

      if (tg) {
        tg.ready()
        tg.expand()
        tg.setHeaderColor?.('#080a0f')
        tg.setBackgroundColor?.('#080a0f')
        tg.disableVerticalSwipes?.() // savol varaqlashda tasodifan yopilib ketmasin
      } else if (inTelegram) {
        // Telegram ichidamiz, lekin SDK yuklanmadi -> initData yo'q -> /me 401 berardi.
        // Chalg'ituvchi "Kirish rad etildi" o'rniga aniq sabab va qayta urinish.
        setState((s) => ({
          ...s,
          status: 'error',
          error: { status: 0, message: 'Telegram SDK yuklanmadi. Internetni tekshirib, qayta urining.' },
        }))
        return
      }

      try {
        const data = await api('/me', { signal: controller.signal })
        if (controller.signal.aborted) return
        setState({
          webApp: tg,
          // photo_url initData'da bo'lmasligi mumkin — initDataUnsafe'dan to'ldiramiz
          user: { ...data.user, photo_url: data.user.photo_url || tg?.initDataUnsafe?.user?.photo_url || null },
          isAdmin: data.isAdmin,
          status: 'ready',
          error: null,
        })
      } catch (err) {
        if (controller.signal.aborted) return
        setState((s) => ({ ...s, webApp: tg, status: 'error', error: err }))
      }
    })()

    return () => controller.abort()
  }, [attempt])

  return <TelegramContext.Provider value={{ ...state, retry }}>{children}</TelegramContext.Provider>
}

/**
 * Telegram'ning native "Orqaga" tugmasini boshqaradi.
 * handler null bo'lsa tugma yashiriladi.
 * SDK kech kelishi mumkin, shuning uchun context'dagi webApp'ga bog'lanamiz.
 */
export function useBackButton(handler) {
  const { webApp } = useTelegram()

  useEffect(() => {
    const bb = webApp?.BackButton
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
  }, [webApp, handler])
}
