'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, Shield, CheckCircle, XCircle, Key } from 'lucide-react'

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

const roleLabels: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  ADMIN: { label: 'Admin', color: 'bg-blue-100 text-blue-700' },
  OPERATOR: { label: 'Operador', color: 'bg-green-100 text-green-700' },
  VIEWER: { label: 'Visualizador', color: 'bg-slate-100 text-slate-700' },
}

interface UserTableRowProps {
  user: User
  onResetPassword: (userId: string) => void
  onToggleActive: (userId: string, currentStatus: boolean) => void
}

export function UserTableRow({ user, onResetPassword, onToggleActive }: UserTableRowProps) {
  return (
    <tr className="border-b hover:bg-slate-50">
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
            onClick={() => onResetPassword(user.id)}
            title="Resetar Senha"
          >
            <Key size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleActive(user.id, user.isActive)}
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
  )
}
