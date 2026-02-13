'use client'

import { AIValidationPanel } from '@/components/ai-validation/AIValidationPanel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BrainCircuit, Loader2, RefreshCw } from 'lucide-react'

export interface AIValidationSectionProps {
  agroData: any
  featureFlags: any
  isRunningAIValidation: boolean
  aiValidationError: string | null
  onRunValidation: () => void
}

export function AIValidationSection({
  agroData,
  featureFlags,
  isRunningAIValidation,
  aiValidationError,
  onRunValidation
}: AIValidationSectionProps) {
  if (!featureFlags?.enableAIValidation || featureFlags?.showAIValidation === false || !agroData) {
    return null
  }

  return (
    <div className="space-y-4">
      {agroData.aiValidationResult ? (
        <div className="space-y-3">
          <AIValidationPanel agroData={agroData} />
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onRunValidation}
              disabled={isRunningAIValidation}
              className="text-xs text-violet-600 border-violet-300 hover:bg-violet-50"
            >
              {isRunningAIValidation ? (
                <><Loader2 size={14} className="mr-1.5 animate-spin" />Revalidando...</>
              ) : (
                <><RefreshCw size={14} className="mr-1.5" />Revalidar com IA</>
              )}
            </Button>
            {agroData.aiValidationDate && (
              <span className="text-xs text-slate-400">
                Última validação: {new Date(agroData.aiValidationDate).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-[32px] bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 opacity-20 group-hover:opacity-40 blur-sm transition-all duration-700" />
          <Card className="relative p-0 rounded-[32px] border border-violet-200/60 overflow-hidden bg-white">
            <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-400 to-fuchsia-400 rounded-2xl blur-md opacity-30 group-hover:opacity-50 transition-opacity duration-500" />
                    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                      <BrainCircuit size={26} className="text-white" />
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white shadow-sm">
                        <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-base font-black text-slate-900">Validação Visual por IA</h4>
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 rounded-full">
                        Multimodal
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Agentes de IA analisam imagens de satélite em tempo real para validar as projeções algorítmicas de fenologia com visão computacional.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {[
                        { color: 'bg-blue-400', label: 'Sentinel-2 Óptico' },
                        { color: 'bg-orange-400', label: 'Sentinel-1 SAR' },
                        { color: 'bg-amber-500', label: 'Landsat 8/9' },
                        { color: 'bg-teal-400', label: 'Sentinel-3 OLCI' },
                        { color: 'bg-purple-400', label: 'NDVI Colorizado' },
                        { color: 'bg-emerald-400', label: 'Gemini Vision' }
                      ].map((item) => (
                        <span key={item.label} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-600">
                          <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <Button
                    onClick={onRunValidation}
                    disabled={isRunningAIValidation}
                    className="relative bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300 px-6 py-2.5 h-auto rounded-xl font-bold"
                  >
                    {isRunningAIValidation ? (
                      <><Loader2 size={18} className="mr-2 animate-spin" />Analisando...</>
                    ) : (
                      <><BrainCircuit size={18} className="mr-2" />Executar Validação IA</>
                    )}
                  </Button>
                </div>
              </div>
              {isRunningAIValidation && (
                <div className="mt-5 p-4 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-2xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Loader2 size={16} className="text-white animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-violet-900">Pipeline de Validação Visual em Execução</p>
                      <p className="text-xs text-violet-600">Isso pode levar 30-60 segundos</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { step: '1', label: 'Buscando imagens', icon: '🛰️' },
                      { step: '2', label: 'Curadoria IA', icon: '🔍' },
                      { step: '3', label: 'Análise visual', icon: '🧠' },
                      { step: '4', label: 'Gerando laudo', icon: '📋' }
                    ].map((item) => (
                      <div key={item.step} className="flex items-center gap-2 p-2 bg-white/60 rounded-xl border border-violet-100">
                        <span className="text-base">{item.icon}</span>
                        <span className="text-[10px] font-semibold text-violet-700">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
      {aiValidationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <strong>Erro:</strong> {aiValidationError}
        </div>
      )}
    </div>
  )
}
