import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Tag Manager only in production (see config/gtm.ts)
  env: {
    GTM_ENABLED: process.env.VERCEL_ENV === 'production' ? 'on' : 'off',
  },
  // Image source
  images: {
    formats: ['image/webp'],
    qualities: [60],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.storyblok.com',
      },
    ],
  },
  // Iubenda
  transpilePackages: ['@mep-agency/next-iubenda'],
  // Redirects
  async redirects() {
    return [
      // Basic redirect
      // {
      //   source: '/',
      //   destination: 'https://madeinitalyacademy.com/',
      //   permanent: true,
      // },
      // // Wildcard path matching
      // {
      //   source: '/blog/:slug',
      //   destination: '/news/:slug',
      //   permanent: true,
      // },
    ]
  },
}

export default nextConfig
