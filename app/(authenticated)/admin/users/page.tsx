'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Users, Plus, Loader2, AlertCircle } from 'lucide-react'
import { CreateUserModal } from '@/components/admin/CreateUserModal'
import { UserTableRow } from '@/components/admin/UserTableRow'

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
  workspace?: {
    id: string
    name: string
    slug: string
  }
}

interface Workspace {
  id: string
  name: string
  slug: string
}

interface CurrentUser {
  role: string
  workspaceId: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)

  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('OPERATOR')
  const [newPassword, setNewPassword] = useState('Mudar@123')
  const [newWorkspaceId, setNewWorkspaceId] = useState('')

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setCurrentUser({ role: data.user.role, workspaceId: data.user.workspaceId })
        return data.user.role
      }
    } catch (err) {
      console.error('Error fetching current user:', err)
    }
    return null
  }

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/admin/workspaces')
      if (res.ok) {
        const data = await res.json()
        setWorkspaces(data.workspaces || [])
      }
    } catch (err) {
      console.log('Não é SUPER_ADMIN, não carregando workspaces')
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Falha ao buscar usuários')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      const role = await fetchCurrentUser()
      if (role === 'SUPER_ADMIN') {
        await fetchWorkspaces()
      }
      await fetchUsers()
    }
    init()
  }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        name: newName,
        email: newEmail,
        role: newRole,
        password: newPassword,
      }
      
      if (currentUser?.role === 'SUPER_ADMIN' && newWorkspaceId) {
        payload.workspaceId = newWorkspaceId
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha ao criar usuário')
      }

      // Reset form
      setNewName('')
      setNewEmail('')
      setNewRole('OPERATOR')
      setNewPassword('Mudar@123')
      setNewWorkspaceId('')
      setShowCreateModal(false)

      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setCreating(false)
    }
  }

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Resetar senha para "Mudar@123"?')) return

    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: 'Mudar@123' }),
      })

      if (!res.ok) throw new Error('Falha ao resetar senha')
      
      alert('Senha resetada com sucesso!')
      await fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao resetar senha')
    }
  }

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (!res.ok) throw new Error('Falha ao atualizar usuário')
      await fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar')
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-emerald-600" />
            Gestão de Usuários
          </h1>
          <p className="text-slate-500 mt-1">
            Gerencie os usuários do seu workspace
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={18} className="mr-2" />
          Novo Usuário
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">
                  Usuário
                </th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">
                  Função
                </th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">
                  Status
                </th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">
                  Último Acesso
                </th>
                <th className="text-right p-4 text-xs font-bold text-slate-500 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  onResetPassword={handleResetPassword}
                  onToggleActive={handleToggleActive}
                />
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CreateUserModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateUser}
        creating={creating}
        currentUserRole={currentUser?.role ?? null}
        workspaces={workspaces}
        newName={newName}
        setNewName={setNewName}
        newEmail={newEmail}
        setNewEmail={setNewEmail}
        newRole={newRole}
        setNewRole={setNewRole}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        newWorkspaceId={newWorkspaceId}
        setNewWorkspaceId={setNewWorkspaceId}
      />
    </div>
  )
}
