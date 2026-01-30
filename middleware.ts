import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'merx-agro-secret-key-change-in-production'
)

// Rotas públicas que não precisam de autenticação
const publicRoutes = [
  '/login',
  '/change-password',
  '/api/auth/login',
  '/api/auth/logout',
]

// Rotas que começam com esses prefixos são públicas
const publicPrefixes = [
  '/_next',
  '/favicon',
  '/api/auth',
]

function isPublicRoute(pathname: string): boolean {
  // Rotas exatas
  if (publicRoutes.includes(pathname)) return true
  
  // Prefixos públicos
  for (const prefix of publicPrefixes) {
    if (pathname.startsWith(prefix)) return true
  }
  
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Permitir rotas públicas
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }
  
  // Verificar token de autenticação
  const token = request.cookies.get('auth-token')?.value
  
  if (!token) {
    // Redirecionar para login se não autenticado
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  try {
    // Validar token
    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    // Verificar se precisa trocar senha
    // Nota: mustChangePassword é verificado no cliente após login
    
    // Injetar headers com dados do usuário para as API routes
    const response = NextResponse.next()
    response.headers.set('x-user-id', payload.userId as string)
    response.headers.set('x-workspace-id', payload.workspaceId as string)
    response.headers.set('x-user-role', payload.role as string)
    
    return response
  } catch {
    // Token inválido - redirecionar para login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('auth-token')
    
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
