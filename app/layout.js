import Script from 'next/script'
import './globals.css'
import { TelegramProvider } from './providers'

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
    <html lang="uz">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Manrope:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Telegram SDK hydration'dan oldin yuklanishi shart */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <TelegramProvider>
          <div id="app">{children}</div>
        </TelegramProvider>
      </body>
    </html>
  )
}
