// pages/api/user/business.ts (oppure pages/api/business.ts)
import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { updateStory, uploadAssetToStoryblok, getStoryById } from '@modules/storyblok'
import { upsertContact } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ message: `Metodo ${req.method} non consentito` })
  }

  // 1. Verifica Cookie JWT
  const token = req.cookies.miia_auth_token
  if (!token) {
    return res.status(401).json({ message: 'Non autorizzato: effettua prima il login' })
  }

  let authData: AuthPayload & { iat?: number; exp?: number }
  try {
    authData = jwt.verify(token, JWT_SECRET) as any
  } catch {
    return res.status(401).json({ message: 'Sessione scaduta o non valida' })
  }

  const { storyblok_id, email: currentEmail } = authData
  const storyblok_uuid = (authData as Record<string, any>).storyblok_uuid

  if (!storyblok_id) {
    return res.status(400).json({ message: 'ID Azienda non trovato nella sessione' })
  }

  try {
    if (req.method === 'PUT') {
      const {
        nome,
        contact_person,
        email,
        address,
        website,
        description,
        area,
        logoBase64,
        logoFileName,
        logoMimeType,
      } = req.body

      let logoUrl = ''

      // Upload eventuale nuovo Logo
      if (logoBase64 && logoFileName) {
        const buffer = Buffer.from(logoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
        logoUrl = await uploadAssetToStoryblok(buffer, logoFileName, logoMimeType || 'image/png')
      }

      // 🛠️ FIX PUNTO 1: Formattazione del campo Multilink per Storyblok
      const cleanWebsite = typeof website === 'string' ? website.trim() : ''
      const formattedWebsite = cleanWebsite
        ? {
          url: cleanWebsite.startsWith('http') ? cleanWebsite : `https://${cleanWebsite}`,
          linktype: 'url',
        }
        : { url: '', linktype: 'url' }

      // Preparazione payload di aggiornamento con fallback difensivo
      const businessContent: Record<string, any> = {
        component: 'business',
        title: nome || authData.company || '',
        nome: nome || authData.company || '',
        contact_person: contact_person || authData.contact_person || '',
        email: (email || currentEmail).trim().toLowerCase(),
        address: address || '',
        website: formattedWebsite, // 👈 Oggetto Multilink valido per Storyblok
        description: description || '',
        area: area || '',
      }

      // 🛡️ PRESERVAZIONE LOGO: Se c'è un nuovo logo usa quello, altrimenti conserva quello già esistente
      if (logoUrl) {
        businessContent.logo = {
          filename: logoUrl,
          fieldtype: 'asset',
        }
      } else {
        try {
          const currentStory = await getStoryById(storyblok_id)
          if (currentStory?.content?.logo) {
            businessContent.logo = currentStory.content.logo
          }
        } catch {
          // Se la chiamata fallisce prosegue senza bloccare l'aggiornamento
        }
      }

      // 2. Esecuzione Update su Storyblok
      await updateStory(storyblok_id, businessContent)

      // 3. Sync CRM Brevo
      await upsertContact({
        email: businessContent.email,
        attributes: {
          NOME: businessContent.contact_person || businessContent.title,
          AZIENDA: businessContent.title,
          STORYBLOK_ID: storyblok_id,
          STORYBLOK_UUID: storyblok_uuid,
        },
      })

      // 4. Pulizia metadata JWT e Costruzione del nuovo Payload
      const { iat, exp, ...cleanAuthData } = authData

      const updatedPayload: AuthPayload = {
        ...cleanAuthData,
        company: businessContent.title,
        contact_person: businessContent.contact_person,
        email: businessContent.email,
        storyblok_id,
        storyblok_uuid,
      }

      // 5. Rigenerazione Token & Scrittura Cookie
      const updatedToken = jwt.sign(updatedPayload, JWT_SECRET, {
        expiresIn: AUTH_JWT_EXPIRES_IN,
      })
      const isProd = process.env.NODE_ENV === 'production'
      const encodedUserData = encodeURIComponent(JSON.stringify(updatedPayload))

      res.setHeader('Set-Cookie', [
        `miia_auth_token=${updatedToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
        `miia_user=${encodedUserData}; Path=/; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
      ])

      return res.status(200).json({
        message: 'Profilo aziendale aggiornato con successo!',
        user: updatedPayload,
      })
    }
  } catch (error: any) {
    console.error('[API Business PUT Error]', error)
    return res.status(500).json({
      message: error?.message || 'Errore durante l\'aggiornamento del profilo aziendale',
    })
  }
}