'use client'

import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_PROCESSING_STEPS, ProcessingStep } from '@/contexts/processing-context'

export function useProcessingModal(
  fieldStatus: string | undefined,
  fieldId: string,
  onFetchData: () => void
) {
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([])
  const [processingStartTime, setProcessingStartTime] = useState<Date | null>(null)
  const [showProcessingModal, setShowProcessingModal] = useState(false)

  const openForReprocess = useCallback(() => {
    setShowProcessingModal(true)
    setProcessingStartTime(new Date())
    setProcessingSteps(DEFAULT_PROCESSING_STEPS.map((s, idx) => ({
      ...s,
      status: idx === 0 ? 'running' as const : 'pending' as const
    })))
  }, [])

  useEffect(() => {
    if (fieldStatus === 'PROCESSING') {
      setShowProcessingModal(true)
      setProcessingStartTime(new Date())
      setProcessingSteps(DEFAULT_PROCESSING_STEPS.map((s, idx) => ({
        ...s,
        status: idx === 0 ? 'running' as const : 'pending' as const
      })))

      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/fields/${fieldId}/status`)
          if (res.ok) {
            const statusData = await res.json()
            if (statusData.status === 'SUCCESS' || statusData.status === 'PARTIAL') {
              clearInterval(pollInterval)
              setProcessingSteps(prev => prev.map(s => ({ ...s, status: 'completed' as const })))
              setTimeout(() => {
                setShowProcessingModal(false)
                onFetchData()
              }, 1500)
            } else if (statusData.status === 'ERROR') {
              clearInterval(pollInterval)
              setProcessingSteps(prev => prev.map(s =>
                s.status === 'running' ? { ...s, status: 'error' as const } : s
              ))
              setTimeout(() => {
                setShowProcessingModal(false)
                onFetchData()
              }, 2000)
            }
          }
        } catch (e) {
          console.error('Polling error:', e)
        }
      }, 5000)

      const stepInterval = setInterval(() => {
        setProcessingSteps(prev => {
          const runningIdx = prev.findIndex(s => s.status === 'running')
          if (runningIdx >= 0 && runningIdx < prev.length - 1) {
            return prev.map((s, idx) => {
              if (idx === runningIdx) return { ...s, status: 'completed' as const }
              if (idx === runningIdx + 1) return { ...s, status: 'running' as const }
              return s
            })
          }
          return prev
        })
      }, 15000)

      return () => {
        clearInterval(pollInterval)
        clearInterval(stepInterval)
      }
    } else {
      if (showProcessingModal && fieldStatus) {
        setShowProcessingModal(false)
      }
    }
  }, [fieldStatus, fieldId, showProcessingModal, onFetchData])

  return { processingSteps, processingStartTime, showProcessingModal, setShowProcessingModal, openForReprocess }
}
