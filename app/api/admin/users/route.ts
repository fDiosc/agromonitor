import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, hashPassword, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

/**
 * GET /api/admin/users
 * Lista todos os usuários do workspace
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Apenas ADMIN e SUPER_ADMIN podem listar usuários
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return forbiddenResponse('Sem permissão para listar usuários')
    }

    const users = await prisma.user.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/users
 * Cria um novo usuário no workspace
 * 
 * SUPER_ADMIN pode especificar workspaceId para criar em qualquer workspace
 * ADMIN cria apenas no próprio workspace
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Apenas ADMIN e SUPER_ADMIN podem criar usuários
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return forbiddenResponse('Sem permissão para criar usuários')
    }

    const body = await request.json()
    const { name, email, role, password, workspaceId: targetWorkspaceId } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Determinar workspace de destino
    // SUPER_ADMIN pode criar em qualquer workspace
    // ADMIN só pode criar no próprio workspace
    let finalWorkspaceId = session.workspaceId
    
    if (targetWorkspaceId && session.role === 'SUPER_ADMIN') {
      // Verificar se workspace existe
      const targetWorkspace = await prisma.workspace.findUnique({
        where: { id: targetWorkspaceId }
      })
      
      if (!targetWorkspace) {
        return NextResponse.json(
          { error: 'Workspace não encontrado' },
          { status: 400 }
        )
      }
      
      finalWorkspaceId = targetWorkspaceId
    } else if (targetWorkspaceId && session.role !== 'SUPER_ADMIN') {
      return forbiddenResponse('Apenas Super Admin pode criar usuários em outros workspaces')
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 400 }
      )
    }

    // Verificar limite de usuários
    const workspace = await prisma.workspace.findUnique({
      where: { id: finalWorkspaceId },
      include: { users: { select: { id: true } } },
    })

    if (workspace && workspace.users.length >= workspace.maxUsers) {
      return NextResponse.json(
        { error: `Limite de ${workspace.maxUsers} usuários atingido` },
        { status: 400 }
      )
    }

    // Validar role
    const validRoles = ['VIEWER', 'OPERATOR', 'ADMIN']
    let userRole = validRoles.includes(role) ? role : 'VIEWER'

    // SUPER_ADMIN só pode ser criado por outro SUPER_ADMIN
    if (role === 'SUPER_ADMIN') {
      if (session.role !== 'SUPER_ADMIN') {
        return forbiddenResponse('Apenas Super Admin pode criar outro Super Admin')
      }
      userRole = 'SUPER_ADMIN'
    }

    // Criar usuário
    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: userRole,
        workspaceId: finalWorkspaceId,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
