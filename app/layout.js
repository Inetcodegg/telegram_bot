import Script from 'next/script'
import { Fraunces, Manrope } from 'next/font/google'
import './globals.css'
import { TelegramProvider } from './providers'

// Shriftlar build vaqtida yuklab olinib, o'z domenimizdan beriladi.
// Runtime'da fonts.googleapis.com'ga so'rov ketmaydi — bloklangan tarmoqda ham ochiladi.
const display = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-display' })
const sans = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-sans' })

export const metadata = {
  title: 'Quiz — Telegram Mini App',
  description: 'Mavzular bo\'yicha testlar va natijalar tahlili',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#080a0f',
}

export default function RootLayout({ children }) {
  return (
    <html lang="uz" className={`${display.variable} ${sans.variable}`}>
      <body>
        {/*
          Telegram SDK ATAYIN `beforeInteractive` EMAS: u hydration'ni bloklaydi.
          telegram.org javob bermasa (bloklangan/sekin tarmoq) sahifa abadiy
          "Yuklanmoqda…" holatida qotib qolardi. `afterInteractive` bilan sahifa
          avval jonlanadi, provider esa SDK'ni timeout bilan kutadi.
        */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <TelegramProvider>
          <div id="app">{children}</div>
        </TelegramProvider>
      </body>
    </html>
  )
}
