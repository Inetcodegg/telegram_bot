import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Uy papkasidagi begona package-lock.json tufayli Turbopack ildizni
  // C:\Users\<user> deb tanlab, butun papkani kuzatardi — dev server sekinlashardi.
  turbopack: { root: projectDir },
  // quests/ va data/ papkalari runtime'da o'qiladi, shuning uchun bundle qilinmaydi.
  outputFileTracingIncludes: {
    '/api/**': ['./quests/**/*', './data/**/*'],
  },
}

export default nextConfig
