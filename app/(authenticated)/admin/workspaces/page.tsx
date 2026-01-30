'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Building2,
  Plus,
  Loader2,
  Users,
  Map,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Eye
} from 'lucide-react'
import Link from 'next/link'

interface Workspace {
  id: string
  name: string
  slug: string
  isActive: boolean
  maxFields: number
  maxUsers: number
  createdAt: string
  _count: {
    users: number
    fields: number
  }
}

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newMaxFields, setNewMaxFields] = useState(100)
  const [newMaxUsers, setNewMaxUsers] = useState(10)
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('Mudar@123')

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('/api/admin/workspaces')
      if (!res.ok) {
        if (res.status === 403) {
          setError('Acesso negado. Apenas Super Admin pode acessar esta página.')
          return
        }
        throw new Error('Falha ao buscar workspaces')
      }
      const data = await res.json()
      setWorkspaces(data.workspaces || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  // Auto-gerar slug a partir do nome
  useEffect(() => {
    if (newName && !newSlug) {
      const slug = newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setNewSlug(slug)
    }
  }, [newName, newSlug])

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          slug: newSlug,
          maxFields: newMaxFields,
          maxUsers: newMaxUsers,
          adminName: newAdminName || undefined,
          adminEmail: newAdminEmail || undefined,
          adminPassword: newAdminPassword,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha ao criar workspace')
      }

      // Reset form
      setNewName('')
      setNewSlug('')
      setNewMaxFields(100)
      setNewMaxUsers(10)
      setNewAdminName('')
      setNewAdminEmail('')
      setNewAdminPassword('Mudar@123')
      setShowCreateModal(false)

      // Refresh list
      await fetchWorkspaces()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (workspaceId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/workspaces/${workspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (!res.ok) throw new Error('Falha ao atualizar workspace')
      await fetchWorkspaces()
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

  if (error && workspaces.length === 0) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-purple-600" />
            Gestão de Workspaces
          </h1>
          <p className="text-slate-500 mt-1">
            Gerencie as empresas/clientes da plataforma
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={18} className="mr-2" />
          Novo Workspace
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Workspaces Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workspaces.map((workspace) => (
          <Card key={workspace.id} className={!workspace.isActive ? 'opacity-60' : ''}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{workspace.name}</h3>
                  <p className="text-sm text-slate-500 font-mono">{workspace.slug}</p>
                </div>
                <Badge className={workspace.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                  {workspace.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Users size={16} className="text-slate-400" />
                  <span className="text-slate-600">
                    {workspace._count.users} / {workspace.maxUsers} usuários
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Map size={16} className="text-slate-400" />
                  <span className="text-slate-600">
                    {workspace._count.fields} / {workspace.maxFields} talhões
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link href={`/admin/workspaces/${workspace.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye size={14} className="mr-1" />
                    Ver Detalhes
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleActive(workspace.id, workspace.isActive)}
                  title={workspace.isActive ? 'Desativar' : 'Ativar'}
                >
                  {workspace.isActive ? (
                    <XCircle size={16} className="text-red-500" />
                  ) : (
                    <CheckCircle size={16} className="text-emerald-500" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {workspaces.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            Nenhum workspace encontrado
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-slate-900">Novo Workspace</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="p-4 space-y-4">
              <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-700">
                <strong>Dica:</strong> Ao criar o workspace, você pode já criar o admin inicial. 
                Ele receberá as credenciais para acessar.
              </div>

              <div className="border-b pb-4">
                <h3 className="font-medium text-slate-700 mb-3">Dados do Workspace</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome da Empresa *
                    </label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ex: Trading ABC"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Slug (URL) *
                    </label>
                    <Input
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="ex: trading-abc"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Apenas letras minúsculas, números e hífens
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Limite de Talhões
                      </label>
                      <Input
                        type="number"
                        value={newMaxFields}
                        onChange={(e) => setNewMaxFields(parseInt(e.target.value) || 100)}
                        min={1}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Limite de Usuários
                      </label>
                      <Input
                        type="number"
                        value={newMaxUsers}
                        onChange={(e) => setNewMaxUsers(parseInt(e.target.value) || 10)}
                        min={1}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-slate-700 mb-3">Admin Inicial (opcional)</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome do Admin
                    </label>
                    <Input
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder="Nome completo"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email do Admin
                    </label>
                    <Input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="admin@empresa.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Senha Inicial
                    </label>
                    <Input
                      type="text"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="Senha temporária"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      O usuário será solicitado a trocar no primeiro login
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
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
                    'Criar Workspace'
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
