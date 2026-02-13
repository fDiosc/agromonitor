/**
 * Sentinel-1 Radar Service - Authentication
 */

import prisma from '@/lib/prisma'
import type { CopernicusAuth } from './types'

const COPERNICUS_TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'

// Cache de tokens por workspace
export const tokenCache = new Map<string, CopernicusAuth>()

/**
 * Obtém credenciais Copernicus do workspace
 */
export async function getCopernicusCredentials(workspaceId: string): Promise<{
  clientId: string
  clientSecret: string
} | null> {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId },
    select: {
      copernicusClientId: true,
      copernicusClientSecret: true
    }
  })

  if (!settings?.copernicusClientId || !settings?.copernicusClientSecret) {
    return null
  }

  return {
    clientId: settings.copernicusClientId,
    clientSecret: settings.copernicusClientSecret
  }
}

/**
 * Obtém access token do Copernicus Data Space (OAuth2)
 */
export async function getAccessToken(workspaceId: string): Promise<string | null> {
  // Verificar cache
  const cached = tokenCache.get(workspaceId)
  if (cached && cached.expiresAt > new Date()) {
    return cached.accessToken
  }

  // Buscar credenciais
  const credentials = await getCopernicusCredentials(workspaceId)
  if (!credentials) {
    console.log('[SENTINEL1] No Copernicus credentials configured for workspace')
    return null
  }

  try {
    const response = await fetch(COPERNICUS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      console.error('[SENTINEL1] Token request failed:', response.status)
      return null
    }

    const data = await response.json()

    // Calcular expiração (com margem de 5 minutos)
    const expiresIn = data.expires_in || 300
    const expiresAt = new Date(Date.now() + (expiresIn - 300) * 1000)

    // Cachear token
    tokenCache.set(workspaceId, {
      accessToken: data.access_token,
      expiresAt
    })

    console.log('[SENTINEL1] Token obtained, expires in', expiresIn, 'seconds')
    return data.access_token
  } catch (error) {
    console.error('[SENTINEL1] Error getting access token:', error)
    return null
  }
}
