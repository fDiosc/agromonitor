import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuthenticatedLayoutClient } from './layout-client'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Buscar dados atualizados do usuário
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { workspace: true },
  })

  if (!user || !user.isActive) {
    redirect('/login')
  }

  // Verificar se precisa trocar senha
  if (user.mustChangePassword) {
    redirect('/change-password')
  }

  return (
    <AuthenticatedLayoutClient
      user={{
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        workspaceId: user.workspaceId,
        workspaceName: user.workspace.name,
        hasAcceptedDisclaimer: user.hasAcceptedDisclaimer,
      }}
    >
      {children}
    </AuthenticatedLayoutClient>
  )
}
