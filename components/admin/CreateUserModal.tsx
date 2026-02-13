'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Loader2, Building2 } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  slug: string
}

interface CreateUserModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  creating: boolean
  currentUserRole: string | null
  workspaces: Workspace[]
  newName: string
  setNewName: (v: string) => void
  newEmail: string
  setNewEmail: (v: string) => void
  newRole: string
  setNewRole: (v: string) => void
  newPassword: string
  setNewPassword: (v: string) => void
  newWorkspaceId: string
  setNewWorkspaceId: (v: string) => void
}

export function CreateUserModal({
  open,
  onClose,
  onSubmit,
  creating,
  currentUserRole,
  workspaces,
  newName,
  setNewName,
  newEmail,
  setNewEmail,
  newRole,
  setNewRole,
  newPassword,
  setNewPassword,
  newWorkspaceId,
  setNewWorkspaceId,
}: CreateUserModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-slate-900">Novo Usuário</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          {currentUserRole === 'SUPER_ADMIN' && workspaces.length > 0 && (
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
              {currentUserRole === 'SUPER_ADMIN' && (
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
              onClick={onClose}
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
  )
}
