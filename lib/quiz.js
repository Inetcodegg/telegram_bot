/** Savol turlari va ularning o'zbekcha nomlari. */
export const QUESTION_TYPES = {
  true_false: "To'g'ri / Noto'g'ri",
  multiple_choice: 'Variantli savol',
}

export const DIFFICULTIES = { easy: 'Oson', medium: "O'rtacha", hard: 'Qiyin' }

/** `options` obyekt ({A: '...'}) yoki massiv bo'lishi mumkin — ikkalasini bir shaklga keltiramiz. */
export function normalizeOptions(question) {
  if (question.type === 'true_false') {
    return [
      { key: 'True', text: "To'g'ri" },
      { key: 'False', text: "Noto'g'ri" },
    ]
  }
  const opts = question.options
  if (Array.isArray(opts)) {
    return opts.map((text, i) => ({ key: String.fromCharCode(65 + i), text: String(text) }))
  }
  if (opts && typeof opts === 'object') {
    return Object.entries(opts).map(([key, text]) => ({ key, text: String(text) }))
  }
  return []
}

/**
 * Savol uchun vaqtni aniqlaydi (soniya). Ustuvorlik tartibi:
 * savolning o'zidagi time_limit → mavzu+tur → mavzu standarti → global tur → global standart.
 */
export function resolveTimeLimit(question, settings, topicSlug) {
  const topic = settings.topics?.[topicSlug] || {}
  const candidates = [
    question.time_limit,
    topic.timers?.[question.type],
    topic.defaultTimer,
    settings.globalTimers?.[question.type],
    settings.defaultTimer,
    30,
  ]
  for (const c of candidates) {
    const n = Number(c)
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return 30
}

/** Clientga yuboriladigan shakl — `answer` va `explanation` OLIB TASHLANADI. */
export function toPublicQuestion(question, timeLimit) {
  return {
    number: question.number,
    type: question.type,
    difficulty: question.difficulty || 'medium',
    category: question.category || null,
    question: question.question,
    options: normalizeOptions(question),
    timeLimit,
  }
}

function norm(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function isCorrect(question, given) {
  if (given == null || given === '') return false
  return norm(given) === norm(question.answer)
}

/** Savol raqami bo'yicha topish (`number` maydoni indeksga teng bo'lmasligi mumkin). */
export function findQuestion(topic, number) {
  return topic.questions.find((q) => Number(q.number) === Number(number)) || null
}

/**
 * Urinishni serverda baholaydi. Client faqat javoblarni yuboradi —
 * ball, to'g'ri javob va tahlil shu yerda hisoblanadi.
 */
export function gradeAttempt(topic, settings, submittedAnswers) {
  const byNumber = new Map(submittedAnswers.map((a) => [Number(a.number), a]))
  const review = []

  let correctCount = 0
  let timedOutCount = 0
  let skippedCount = 0
  let totalTimeSpent = 0

  for (const q of topic.questions) {
    const submitted = byNumber.get(Number(q.number))
    const given = submitted?.answer ?? null
    const correct = isCorrect(q, given)
    const timedOut = Boolean(submitted?.timedOut)
    const timeSpent = Math.max(0, Math.round(Number(submitted?.timeSpent) || 0))

    if (correct) correctCount++
    if (timedOut) timedOutCount++
    if (given == null || given === '') skippedCount++
    totalTimeSpent += timeSpent

    review.push({
      number: q.number,
      type: q.type,
      difficulty: q.difficulty || 'medium',
      category: q.category || null,
      question: q.question,
      options: normalizeOptions(q),
      timeLimit: resolveTimeLimit(q, settings, topic.slug),
      givenAnswer: given,
      correctAnswer: q.answer,
      explanation: q.explanation || null,
      isCorrect: correct,
      timedOut,
      timeSpent,
    })
  }

  const total = topic.questions.length
  const breakdown = (field) => {
    const map = {}
    for (const r of review) {
      const key = r[field] || 'other'
      map[key] = map[key] || { total: 0, correct: 0 }
      map[key].total++
      if (r.isCorrect) map[key].correct++
    }
    return map
  }

  return {
    total,
    correctCount,
    wrongCount: total - correctCount,
    timedOutCount,
    skippedCount,
    totalTimeSpent,
    scorePercent: total ? Math.round((correctCount / total) * 100) : 0,
    byDifficulty: breakdown('difficulty'),
    byCategory: breakdown('category'),
    byType: breakdown('type'),
    review,
  }
}

/** Yuklangan JSON to'g'ri formatda ekanini tekshiradi. Xatolar ro'yxatini qaytaradi. */
export function validateQuestSchema(data) {
  const errors = []
  if (!data || typeof data !== 'object') return ['JSON obyekt bo\'lishi kerak']
  if (!Array.isArray(data.questions)) return ["`questions` massiv bo'lishi shart"]
  if (data.questions.length === 0) return ['Kamida bitta savol bo\'lishi kerak']

  const seen = new Set()
  data.questions.forEach((q, i) => {
    const at = `Savol #${i + 1}`
    if (!Number.isFinite(Number(q.number))) errors.push(`${at}: \`number\` raqam bo'lishi kerak`)
    else if (seen.has(Number(q.number))) errors.push(`${at}: \`number\` takrorlangan (${q.number})`)
    else seen.add(Number(q.number))

    if (!q.question || typeof q.question !== 'string') errors.push(`${at}: \`question\` matn bo'lishi kerak`)
    if (!QUESTION_TYPES[q.type]) errors.push(`${at}: \`type\` faqat ${Object.keys(QUESTION_TYPES).join(' yoki ')} bo'lishi mumkin`)
    if (q.answer == null || q.answer === '') errors.push(`${at}: \`answer\` bo'sh`)

    if (q.type === 'true_false') {
      if (!['true', 'false'].includes(norm(q.answer))) errors.push(`${at}: \`answer\` "True" yoki "False" bo'lishi kerak`)
    } else if (q.type === 'multiple_choice') {
      const opts = normalizeOptions(q)
      if (opts.length < 2) errors.push(`${at}: kamida 2 ta variant kerak`)
      else if (!opts.some((o) => norm(o.key) === norm(q.answer))) {
        errors.push(`${at}: \`answer\` ("${q.answer}") variantlar orasida yo'q`)
      }
    }
    if (q.difficulty && !DIFFICULTIES[q.difficulty]) errors.push(`${at}: \`difficulty\` easy/medium/hard bo'lishi kerak`)
  })

  return errors.slice(0, 20)
}
