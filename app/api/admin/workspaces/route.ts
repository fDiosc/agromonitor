import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, hashPassword, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

/**
 * GET /api/admin/workspaces
 * Lista todos os workspaces (apenas SUPER_ADMIN)
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Apenas SUPER_ADMIN pode listar todos os workspaces
    if (session.role !== 'SUPER_ADMIN') {
      return forbiddenResponse('Apenas Super Admin pode gerenciar workspaces')
    }

    const workspaces = await prisma.workspace.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            fields: true,
          },
        },
      },
    })

    return NextResponse.json({ workspaces })
  } catch (error) {
    console.error('Erro ao listar workspaces:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/workspaces
 * Cria um novo workspace com admin inicial
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Apenas SUPER_ADMIN pode criar workspaces
    if (session.role !== 'SUPER_ADMIN') {
      return forbiddenResponse('Apenas Super Admin pode criar workspaces')
    }

    const body = await request.json()
    const { 
      name, 
      slug, 
      maxFields = 100, 
      maxUsers = 10,
      // Dados do admin inicial (opcional)
      adminName,
      adminEmail,
      adminPassword = 'Mudar@123'
    } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Nome e slug são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar slug (lowercase, sem espaços, apenas letras, números e hífens)
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: 'Slug deve conter apenas letras minúsculas, números e hífens' },
        { status: 400 }
      )
    }

    // Verificar se slug já existe
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug },
    })

    if (existingWorkspace) {
      return NextResponse.json(
        { error: 'Já existe um workspace com este slug' },
        { status: 400 }
      )
    }

    // Criar workspace
    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        maxFields,
        maxUsers,
        isActive: true,
      },
    })

    // Se dados de admin foram fornecidos, criar usuário admin
    let admin = null
    if (adminEmail) {
      // Verificar se email já existe
      const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail.toLowerCase() },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email do admin já está em uso' },
          { status: 400 }
        )
      }

      const passwordHash = await hashPassword(adminPassword)
      admin = await prisma.user.create({
        data: {
          name: adminName || 'Administrador',
          email: adminEmail.toLowerCase(),
          passwordHash,
          role: 'ADMIN',
          workspaceId: workspace.id,
          mustChangePassword: true,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      })
    }

    return NextResponse.json({ 
      workspace,
      admin,
      message: admin 
        ? `Workspace criado com admin ${admin.email}` 
        : 'Workspace criado sem admin. Adicione usuários manualmente.'
    }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar workspace:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
