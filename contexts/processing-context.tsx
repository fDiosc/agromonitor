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
    
    // Set initial elapsed time
    setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000))
    
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000))
    }, 1000)
    
    return () => clearInterval(interval)
  }, [startTime])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${seconds}s`
  }

  const getStepIcon = (step: ProcessingStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle size={18} className="text-green-500" />
      case 'running':
        return <Loader2 size={18} className="animate-spin text-blue-500" />
      case 'error':
        return <XCircle size={18} className="text-red-500" />
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-500" />
      default:
        return <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300" />
    }
  }

  const completedSteps = steps.filter(s => s.status === 'completed').length
  const currentStep = steps.find(s => s.status === 'running')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop com blur */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-purple-700 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Satellite size={28} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{fieldName}</h3>
              <p className="text-white/80 text-sm">Processando dados...</p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>{currentStep?.label || 'Finalizando...'}</span>
              <span>{formatTime(elapsedSeconds)}</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${(completedSteps / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-3">
          {steps.map((step) => (
            <div 
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                step.status === 'completed' ? 'bg-green-50' :
                step.status === 'running' ? 'bg-blue-50' :
                step.status === 'error' ? 'bg-red-50' :
                'bg-slate-50'
              }`}
            >
              {getStepIcon(step)}
              <span className={`text-sm font-medium ${
                step.status === 'completed' ? 'text-green-700' :
                step.status === 'running' ? 'text-blue-700' :
                step.status === 'error' ? 'text-red-700' :
                'text-slate-400'
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={() => {
              onClose?.()
              router.push('/')
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
          >
            <ArrowLeft size={18} />
            Voltar para Dashboard
          </button>
          <p className="text-xs text-slate-400 text-center">
            Você pode sair desta página. O processamento continua em segundo plano.
          </p>
        </div>
      </div>
    </div>
  )
}
