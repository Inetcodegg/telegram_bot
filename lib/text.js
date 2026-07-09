/** Sarlavhadan fayl nomiga yaroqli slug yasaydi: "The Noun" -> "the-noun" */
export function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}
