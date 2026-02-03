'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Users,
  Plus,
  Loader2,
  MoreVertical,
  Mail,
  Shield,
  CheckCircle,
  XCircle,
  Key,
  Trash2,
  AlertCircle,
  X,
  Building2
} from 'lucide-react'

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

const roleLabels: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  ADMIN: { label: 'Admin', color: 'bg-blue-100 text-blue-700' },
  OPERATOR: { label: 'Operador', color: 'bg-green-100 text-green-700' },
  VIEWER: { label: 'Visualizador', color: 'bg-slate-100 text-slate-700' },
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
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
      // ADMIN não tem acesso a workspaces, tudo bem
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
      const payload: any = {
        name: newName,
        email: newEmail,
        role: newRole,
        password: newPassword,
      }
      
      // SUPER_ADMIN pode especificar workspace
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

      // Refresh list
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

      {/* Users Table */}
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
                <tr key={user.id} className="border-b hover:bg-slate-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <Mail size={12} />
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge className={roleLabels[user.role]?.color || 'bg-slate-100'}>
                      <Shield size={12} className="mr-1" />
                      {roleLabels[user.role]?.label || user.role}
                    </Badge>
                  </td>
                  <td className="p-4">
                    {user.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <CheckCircle size={12} className="mr-1" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">
                        <XCircle size={12} className="mr-1" />
                        Inativo
                      </Badge>
                    )}
                    {user.mustChangePassword && (
                      <Badge className="ml-2 bg-yellow-100 text-yellow-700">
                        Senha pendente
                      </Badge>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Nunca'}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetPassword(user.id)}
                        title="Resetar Senha"
                      >
                        <Key size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(user.id, user.isActive)}
                        title={user.isActive ? 'Desativar' : 'Ativar'}
                      >
                        {user.isActive ? (
                          <XCircle size={16} className="text-red-500" />
                        ) : (
                          <CheckCircle size={16} className="text-emerald-500" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
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

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-slate-900">Novo Usuário</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-4 space-y-4">
              {/* Seletor de Workspace - apenas para SUPER_ADMIN */}
              {currentUser?.role === 'SUPER_ADMIN' && workspaces.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Building2 size={14} className="inline mr-1" />
                    Workspace
                  </label>
                  <select
                    value={newWorkspaceId}
                    onChange={(e) => setNewWorkspaceId(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">Workspace atual</option>
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name} ({ws.slug})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Selecione em qual workspace criar o usuário
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@empresa.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Função
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="VIEWER">Visualizador</option>
                  <option value="OPERATOR">Operador</option>
                  <option value="ADMIN">Admin</option>
                  {currentUser?.role === 'SUPER_ADMIN' && (
                    <option value="SUPER_ADMIN">Super Admin</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Senha Inicial
                </label>
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Senha temporária"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  O usuário será solicitado a trocar no primeiro login
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Usuário'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
