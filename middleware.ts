import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  // Leggiamo il token dal cookie (Edge compatibile)
  const token = req.cookies.get('miia_auth_token')?.value
  const { pathname } = req.nextUrl

  // Definiamo i pattern delle rotte protette
  const isCompanyRoute = pathname.startsWith('/aziende/profilo')
  const isStudentRoute = pathname.startsWith('/studenti/profilo')
  const isJobDetailRoute = pathname.startsWith('/lavoro/inserzioni')

  // 1. Gestione Deep Linking per Utenti NON loggati
  if (!token && (isCompanyRoute || isStudentRoute || isJobDetailRoute)) {
    const loginPath = isCompanyRoute ? '/aziende/login' : '/studenti/login'
    const redirectUrl = req.nextUrl.clone()

    redirectUrl.pathname = loginPath
    // Salviamo la rotta originale per la UX "magica" post-login
    redirectUrl.searchParams.set('redirectUrl', pathname)

    return NextResponse.redirect(redirectUrl)
  }

  // 2. Controllo degli Accessi Basato sui Ruoli (RBAC)
  if (token) {
    try {
      // Decodifica leggera del payload JWT compatibile con l'Edge Runtime
      const payloadBase64 = token.split('.')[1]
      const decodedJson = Buffer.from(payloadBase64, 'base64').toString()
      const user = JSON.parse(decodedJson)

      // Se uno Studente prova ad andare nella dashboard Azienda -> va al suo profilo
      if (isCompanyRoute && user.tipo_utente !== 'Azienda') {
        return NextResponse.redirect(new URL('/studenti/profilo', req.url))
      }

      // Se un'Azienda prova ad andare nel profilo Studente -> va al suo profilo aziendale
      if (isStudentRoute && user.tipo_utente !== 'Studente') {
        return NextResponse.redirect(new URL('/aziende/profilo', req.url))
      }

      // NOTA: Sia Studente che Azienda POSSONO accedere a /lavoro/inserzioni/:id!
      // Nessun redirect su isJobDetailRoute se l'utente è autenticato.

    } catch (e) {
      console.error('Errore decodifica token nel middleware:', e)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/aziende/:path*', '/studenti/:path*', '/lavoro/inserzioni/:path*'],
}