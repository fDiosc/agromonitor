'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, AlertCircle, Clock, Database, Power } from 'lucide-react'
import { APP_VERSION, getCurrentPhase } from '@/lib/version'

interface DisclaimerModalProps {
  isOpen: boolean
  onAccept: () => void
  userName?: string
  companyName?: string
}

export function DisclaimerModal({ isOpen, onAccept, userName, companyName }: DisclaimerModalProps) {
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const phase = getCurrentPhase()

  if (!isOpen) return null

  const handleAccept = async () => {
    if (!accepted) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/auth/accept-disclaimer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: APP_VERSION }),
      })
      
      if (res.ok) {
        onAccept()
      }
    } catch (error) {
      console.error('Erro ao aceitar disclaimer:', error)
    } finally {
      setLoading(false)
    }
  }

  const disclaimerItems = [
    {
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      title: 'Produto em ALPHA',
      description: 'Este produto está em fase inicial de desenvolvimento (ALPHA). Funcionalidades podem mudar significativamente.',
    },
    {
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      title: 'Bugs e Indisponibilidades',
      description: 'Podem haver bugs, erros ou indisponibilidades temporárias do serviço.',
    },
    {
      icon: CheckCircle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      title: 'Verificação de Dados',
      description: 'As informações exibidas devem sempre ser verificadas ou cruzadas com outras fontes, pois ainda podem haver falhas nos cálculos ou processamentos.',
    },
    {
      icon: AlertCircle,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      title: 'Reporte de Problemas',
      description: 'Bugs, problemas e sugestões de melhorias devem ser reportados para que possamos melhorar o produto.',
    },
    {
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      title: 'Disponibilidade',
      description: 'Poderá haver indisponibilidade do produto a qualquer tempo, embora sempre faremos o possível para minimizar interrupções.',
    },
    {
      icon: Database,
      color: 'text-gray-500',
      bgColor: 'bg-gray-50',
      title: 'Persistência de Dados',
      description: 'Os dados poderão ser perdidos a qualquer tempo durante a fase ALPHA, embora sempre faremos o possível para preservá-los.',
    },
    {
      icon: Power,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      title: 'Descontinuação',
      description: 'O produto/serviço poderá ser descontinuado a qualquer tempo. Neste caso, será dado um prazo de até 10 dias para extração dos dados, com suporte se necessário.',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                Termos de Uso - Versão {phase.label}
              </h2>
              <p className="text-sm text-orange-100">
                {companyName && `${companyName} • `}v{APP_VERSION}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {userName && (
            <p className="text-gray-600 mb-4">
              Olá, <strong>{userName}</strong>! Antes de continuar, leia e aceite os termos abaixo:
            </p>
          )}

          <div className="space-y-4">
            {disclaimerItems.map((item, index) => (
              <div
                key={index}
                className={`flex gap-4 p-4 rounded-lg ${item.bgColor} border border-gray-100`}
              >
                <div className={`flex-shrink-0 ${item.color}`}>
                  <item.icon className="w-5 h-5 mt-0.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {index + 1}. {item.title}
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <label className="flex items-start gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">
              Li e compreendi todos os termos acima. Estou ciente de que este é um produto em fase <strong>{phase.label}</strong> e aceito as condições descritas.
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!accepted || loading}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${
              accepted && !loading
                ? 'bg-orange-500 hover:bg-orange-600 cursor-pointer'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {loading ? 'Processando...' : 'Aceitar e Continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}
