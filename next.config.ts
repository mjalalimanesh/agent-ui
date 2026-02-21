import type { NextConfig } from 'next'

const metabaseOrigin = process.env.NEXT_PUBLIC_METABASE_ORIGIN?.trim()

const frameSrcPolicy = metabaseOrigin
  ? `'self' ${metabaseOrigin}`
  : `'self'`

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      `frame-src ${frameSrcPolicy}`,
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "connect-src 'self' http: https: ws: wss:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    ].join('; ')
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer'
  }
]

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
    ]
  }
}

export default nextConfig
