'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Leaf, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Validações
  const hasMinLength = newPassword.length >= 8
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0
  const isValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!isValid) {
      setError('Por favor, atenda todos os requisitos de senha')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao alterar senha')
        return
      }

      // Sucesso - redirecionar para dashboard
      router.push('/')
      router.refresh()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const ValidationItem = ({
    valid,
    text,
  }: {
    valid: boolean
    text: string
  }) => (
    <div
      className={`flex items-center gap-2 text-sm ${
        valid ? 'text-emerald-600' : 'text-slate-500'
      }`}
    >
      <CheckCircle2
        size={16}
        className={valid ? 'text-emerald-500' : 'text-slate-300'}
      />
      {text}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/30 mb-4">
            <Leaf size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            MERX <span className="text-emerald-400">AGRO</span>
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              Alterar senha
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Por segurança, você precisa definir uma nova senha para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Senha atual
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Nova senha
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Confirmar nova senha
              </label>
              <input
                id="confirmPassword"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            {/* Validations */}
            <div className="p-3 bg-slate-50 rounded-lg space-y-2">
              <p className="text-xs text-slate-600 font-medium mb-2">
                Requisitos da senha:
              </p>
              <ValidationItem valid={hasMinLength} text="Mínimo 8 caracteres" />
              <ValidationItem valid={hasUppercase} text="Uma letra maiúscula" />
              <ValidationItem valid={hasNumber} text="Um número" />
              <ValidationItem valid={passwordsMatch} text="Senhas coincidem" />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Alterando...
                </>
              ) : (
                'Alterar senha e continuar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
