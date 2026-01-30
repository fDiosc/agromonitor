'use client'

import { useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'

interface User {
  userId: string
  name: string
  email: string
  role: string
  workspaceId: string
  workspaceName: string
}

interface AppLayoutProps {
  children: React.ReactNode
  user: User
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
          workspaceName: user.workspaceName,
        }}
        onLogout={handleLogout}
      />
      
      {/* Main content - offset by sidebar width */}
      <main className="ml-64">
        {children}
      </main>
    </div>
  )
}
