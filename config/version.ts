export const getStoryblokVersion = (): 'draft' | 'published' => {
  // 1. Se siamo in locale (npm run dev)
  if (process.env.NODE_ENV === 'development') {
    return 'draft'
  }

  // 2. Se siamo su Vercel in ambiente Preview (es. branch develop o PR)
  if (process.env.VERCEL_ENV === 'preview') {
    return 'draft'
  }

  // 3. Flag custom opzionale per forzare il draft da Vercel Dashboard (es. STORYBLOK_FORCE_DRAFT=true)
  if (process.env.STORYBLOK_FORCE_DRAFT === 'true') {
    return 'draft'
  }

  // 4. Default per la Produzione ufficiale
  return 'published'
}