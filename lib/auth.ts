import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

// ==================== CONFIGURAÇÃO ====================

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'merx-agro-secret-key-change-in-production'
)
const JWT_EXPIRES_IN = '7d'
const COOKIE_NAME = 'auth-token'

// ==================== TIPOS ====================

export interface JWTPayload {
  userId: string
  email: string
  name: string
  role: string
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  [key: string]: unknown // Index signature for jose compatibility
}

export interface SessionUser extends JWTPayload {
  isAuthenticated: true
}

// ==================== PASSWORD ====================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ==================== JWT ====================

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    // #region agent log
    console.log('[DEBUG-AUTH] verifyToken success, userId:', (payload as any).userId)
    // #endregion
    return payload as unknown as JWTPayload
  } catch (err) {
    // #region agent log
    console.log('[DEBUG-AUTH] verifyToken FAILED:', (err as Error).message)
    // #endregion
    return null
  }
}

// ==================== COOKIES ====================

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

export async function removeAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// ==================== SESSION ====================

export async function getSession(): Promise<SessionUser | null> {
  const token = await getAuthCookie()
  if (!token) return null
  
  const payload = await verifyToken(token)
  if (!payload) return null
  
  return {
    ...payload,
    isAuthenticated: true,
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

// ==================== API HELPERS ====================

export function unauthorizedResponse(message = 'Não autorizado') {
  return Response.json({ error: message }, { status: 401 })
}

export function forbiddenResponse(message = 'Acesso negado') {
  return Response.json({ error: message }, { status: 403 })
}
