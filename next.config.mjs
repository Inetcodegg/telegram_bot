/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // quests/ va data/ papkalari runtime'da o'qiladi, shuning uchun bundle qilinmaydi.
  outputFileTracingIncludes: {
    '/api/**': ['./quests/**/*', './data/**/*'],
  },
}

export default nextConfig
