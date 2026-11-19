/**
 * Google Tag Manager loads only on the production site (miia.it).
 * GTM_ENABLED is set in next.config.ts from VERCEL_ENV at build time, so Vercel
 * previews and local development never send visits or conversions to GA4, Ads or Meta.
 */
export function getGtmId(): string | undefined {
  if (process.env.GTM_ENABLED !== 'on') return undefined
  return process.env.NEXT_PUBLIC_GTM || undefined
}
