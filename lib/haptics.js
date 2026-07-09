'use client'

/**
 * Telegram HapticFeedback + brauzer Vibration API zaxirasi.
 * Maqsad: sezilarli, lekin bezovta qilmaydigan qisqa titrash.
 */
function tg() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : null
}

function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern)
  } catch {}
}

/** To'g'ri javob — yengil, qisqa "tasdiq" titrashi. */
export function hapticSuccess() {
  const h = tg()?.HapticFeedback
  if (h?.notificationOccurred) h.notificationOccurred('success')
  else vibrate(18)
}

/** Xato javob — ikki bo'lakli, biroz og'irroq, ammo hali ham qisqa. */
export function hapticError() {
  const h = tg()?.HapticFeedback
  if (h?.notificationOccurred) h.notificationOccurred('error')
  else vibrate([32, 55, 32])
}

/** Vaqt tugadi — ogohlantirish. */
export function hapticWarning() {
  const h = tg()?.HapticFeedback
  if (h?.notificationOccurred) h.notificationOccurred('warning')
  else vibrate([22, 40, 22])
}

/** Tugma bosilishi — deyarli sezilmas. */
export function hapticTap(style = 'light') {
  const h = tg()?.HapticFeedback
  if (h?.impactOccurred) h.impactOccurred(style)
  else vibrate(8)
}

export function hapticSelection() {
  const h = tg()?.HapticFeedback
  if (h?.selectionChanged) h.selectionChanged()
  else vibrate(6)
}
