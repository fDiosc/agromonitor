'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Satellite, CheckCircle, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react'

// ==================== Types ====================

export type ProcessingStep = {
  id: string
  label: string
  status: 'pending' | 'running' | 'completed' | 'error' | 'warning'
  detail?: string
}

interface ProcessingState {
  isActive: boolean
  title: string
  steps: ProcessingStep[]
  currentStep: string | null
  startTime: Date | null
  fieldId: string | null
  fieldName: string | null
}

interface ProcessingContextValue {
  state: ProcessingState
  startProcessing: (params: { 
    fieldId: string
    fieldName: string
    title?: string 
  }) => void
  updateStep: (stepId: string, update: Partial<ProcessingStep>) => void
  addStep: (step: ProcessingStep) => void
  setCurrentStep: (stepId: string) => void
  completeProcessing: (success: boolean, message?: string) => void
  resetProcessing: () => void
  isProcessingField: (fieldId: string) => boolean
}

// ==================== Default Steps ====================

export const DEFAULT_PROCESSING_STEPS: ProcessingStep[] = [
  { id: 'satellite', label: 'Coletando dados de satélite', status: 'pending' },
  { id: 'precipitation', label: 'Buscando precipitação', status: 'pending' },
  { id: 'water_balance', label: 'Calculando balanço hídrico', status: 'pending' },
  { id: 'thermal', label: 'Processando soma térmica', status: 'pending' },
  { id: 'radar', label: 'Integrando dados de radar', status: 'pending' },
  { id: 'analysis', label: 'Gerando análise', status: 'pending' },
]

// ==================== Initial State ====================

const initialState: ProcessingState = {
  isActive: false,
  title: 'Processando...',
  steps: [],
  currentStep: null,
  startTime: null,
  fieldId: null,
  fieldName: null,
}

// ==================== Context ====================

const ProcessingContext = createContext<ProcessingContextValue | null>(null)

// ==================== Provider ====================
// O provider NÃO renderiza overlay global - cada página decide como exibir

export function ProcessingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProcessingState>(initialState)

  const startProcessing = useCallback(({ fieldId, fieldName, title }: { 
    fieldId: string
    fieldName: string
    title?: string 
  }) => {
    const initialSteps = DEFAULT_PROCESSING_STEPS.map((s, idx) => ({ 
      ...s, 
      status: idx === 0 ? 'running' as const : 'pending' as const 
    }))
    
    setState({
      isActive: true,
      title: title || `Processando ${fieldName}...`,
      steps: initialSteps,
      currentStep: 'satellite',
      startTime: new Date(),
      fieldId,
      fieldName,
    })
  }, [])

  const updateStep = useCallback((stepId: string, update: Partial<ProcessingStep>) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === stepId ? { ...step, ...update } : step
      )
    }))
  }, [])

  const addStep = useCallback((step: ProcessingStep) => {
    setState(prev => ({
      ...prev,
      steps: [...prev.steps, step]
    }))
  }, [])

  const setCurrentStep = useCallback((stepId: string) => {
    setState(prev => {
      const updatedSteps = prev.steps.map(step => {
        if (step.id === prev.currentStep && step.status === 'running') {
          return { ...step, status: 'completed' as const }
        }
        if (step.id === stepId) {
          return { ...step, status: 'running' as const }
        }
        return step
      })
      
      return {
        ...prev,
        steps: updatedSteps,
        currentStep: stepId,
      }
    })
  }, [])

  const completeProcessing = useCallback((success: boolean, _message?: string) => {
    setState(prev => ({
      ...prev,
      isActive: false,
      steps: prev.steps.map(step => ({
        ...step,
        status: step.status === 'running' 
          ? (success ? 'completed' : 'error') 
          : step.status === 'pending' 
            ? (success ? 'completed' : 'pending')
            : step.status
      })),
      currentStep: null,
    }))

    // Clear state after delay
    setTimeout(() => {
      setState(initialState)
    }, success ? 1000 : 3000)
  }, [])

  const resetProcessing = useCallback(() => {
    setState(initialState)
  }, [])

  const isProcessingField = useCallback((fieldId: string) => {
    return state.isActive && state.fieldId === fieldId
  }, [state.isActive, state.fieldId])

  return (
    <ProcessingContext.Provider value={{
      state,
      startProcessing,
      updateStep,
      addStep,
      setCurrentStep,
      completeProcessing,
      resetProcessing,
      isProcessingField,
    }}>
      {children}
      {/* NÃO renderiza overlay global - cada página decide */}
    </ProcessingContext.Provider>
  )
}

// ==================== Hook ====================

export function useProcessing() {
  const context = useContext(ProcessingContext)
  if (!context) {
    throw new Error('useProcessing must be used within a ProcessingProvider')
  }
  return context
}

// ==================== Modal Component (para uso na página do report) ====================

interface ProcessingModalProps {
  fieldName: string
  steps: ProcessingStep[]
  startTime: Date | null
  onClose?: () => void
}

export function ProcessingModal({ fieldName, steps, startTime, onClose }: ProcessingModalProps) {
  const router = useRouter()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!startTime) return
    
    setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000))
    
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000))
    }, 1000)
    
    return () => clearInterval(interval)
  }, [startTime])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  const completedSteps = steps.filter(s => s.status === 'completed').length
  const currentStep = steps.find(s => s.status === 'running')
  const progressPercent = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0

  const getStepStyles = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-emerald-50 border-emerald-200',
          icon: 'bg-emerald-500',
          text: 'text-emerald-700',
          iconElement: <CheckCircle size={16} className="text-white" />
        }
      case 'running':
        return {
          bg: 'bg-blue-50 border-blue-200',
          icon: 'bg-blue-500',
          text: 'text-blue-700',
          iconElement: <Loader2 size={16} className="text-white animate-spin" />
        }
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: 'bg-red-500',
          text: 'text-red-700',
          iconElement: <XCircle size={16} className="text-white" />
        }
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-200',
          icon: 'bg-amber-500',
          text: 'text-amber-700',
          iconElement: <AlertTriangle size={16} className="text-white" />
        }
      default:
        return {
          bg: 'bg-slate-50 border-slate-200',
          icon: 'bg-slate-300',
          text: 'text-slate-400',
          iconElement: <div className="w-2 h-2 rounded-full bg-white" />
        }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop com blur */}
      <div 
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
        onClick={() => {
          onClose?.()
          router.push('/')
        }}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header com gradiente MERX */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 px-6 py-8">
          {/* Padrão decorativo */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
          
          <div className="relative flex items-start gap-4">
            {/* Ícone animado */}
            <div className="flex-shrink-0 w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
              <Satellite size={32} className="text-white animate-pulse" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-white truncate">{fieldName}</h3>
              <p className="text-emerald-100 text-sm mt-0.5">Processando dados de satélite...</p>
              
              {/* Tempo decorrido */}
              <div className="mt-3 flex items-center gap-2">
                <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  <span className="text-white text-sm font-medium">{formatTime(elapsedSeconds)}</span>
                </div>
                <span className="text-emerald-100 text-xs">decorrido</span>
              </div>
            </div>
          </div>
          
          {/* Barra de progresso */}
          <div className="relative mt-6">
            <div className="flex justify-between text-xs text-white/80 mb-2">
              <span className="font-medium">{currentStep?.label || 'Finalizando...'}</span>
              <span>{completedSteps} de {steps.length}</span>
            </div>
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Lista de etapas */}
        <div className="px-6 py-5 max-h-[280px] overflow-y-auto">
          <div className="space-y-2">
            {steps.map((step, index) => {
              const styles = getStepStyles(step.status)
              return (
                <div 
                  key={step.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${styles.bg}`}
                >
                  {/* Ícone com número */}
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${styles.icon}`}>
                    {step.status === 'pending' ? (
                      <span className="text-xs font-bold text-white">{index + 1}</span>
                    ) : (
                      styles.iconElement
                    )}
                  </div>
                  
                  {/* Label */}
                  <span className={`text-sm font-medium flex-1 ${styles.text}`}>
                    {step.label}
                  </span>
                  
                  {/* Indicador de running */}
                  {step.status === 'running' && (
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 border-t border-slate-100">
          <button
            onClick={() => {
              onClose?.()
              router.push('/')
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30"
          >
            <ArrowLeft size={18} />
            Voltar para Dashboard
          </button>
          <p className="text-xs text-slate-400 text-center mt-3">
            O processamento continua em segundo plano
          </p>
        </div>
      </div>
    </div>
  )
}
