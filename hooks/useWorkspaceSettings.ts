'use client'

import { useEffect, useState } from 'react'
import type { FeatureFlags, WorkspaceSettings } from '@/lib/types/settings'
import { DEFAULT_FLAGS } from '@/lib/types/settings'

export function useWorkspaceSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessResult, setReprocessResult] = useState<{ fieldsProcessed: number; distancesCalculated: number } | null>(null)

  // Legacy settings
  const [distanceMethod, setDistanceMethod] = useState<'straight_line' | 'road_distance'>('straight_line')
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('')

  // Copernicus credentials
  const [copernicusClientId, setCopernicusClientId] = useState('')
  const [copernicusClientSecret, setCopernicusClientSecret] = useState('')

  // Feature flags
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/workspace/settings')
        if (res.ok) {
          const data = await res.json()
          const settings = data.settings as WorkspaceSettings | null
          if (settings) {
            setDistanceMethod(settings.distanceCalculationMethod || 'straight_line')
            setGoogleMapsApiKey(settings.googleMapsApiKey || '')
          }
          if (data.featureFlags) {
            if (data.featureFlags.copernicusClientId) {
              setCopernicusClientId(data.featureFlags.copernicusClientId)
            }
            if (data.featureFlags.hasCopernicusSecret) {
              setCopernicusClientSecret('********')
            }
          }
          if (data.featureFlags) {
            setFlags({ ...DEFAULT_FLAGS, ...data.featureFlags })
          }
        }
      } catch (err) {
        console.error('Error fetching settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const updateFlag = <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => {
    setFlags(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const featureFlags = {
        ...flags,
        distanceCalculationMethod: distanceMethod,
        googleMapsApiKey: googleMapsApiKey || null,
        copernicusClientId: copernicusClientId || null,
        copernicusClientSecret: copernicusClientSecret && copernicusClientSecret !== '********'
          ? copernicusClientSecret
          : undefined
      }

      const res = await fetch('/api/workspace/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureFlags })
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar')
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const handleReprocess = async () => {
    setReprocessing(true)
    setError(null)
    setReprocessResult(null)

    try {
      const res = await fetch('/api/logistics-units/reprocess', {
        method: 'POST'
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao reprocessar')
        return
      }

      const data = await res.json()
      setReprocessResult({
        fieldsProcessed: data.fieldsProcessed,
        distancesCalculated: data.distancesCalculated
      })
    } catch (err) {
      setError('Erro ao reprocessar distâncias')
    } finally {
      setReprocessing(false)
    }
  }

  return {
    loading,
    saving,
    saved,
    error,
    reprocessing,
    reprocessResult,
    distanceMethod,
    setDistanceMethod,
    googleMapsApiKey,
    setGoogleMapsApiKey,
    copernicusClientId,
    setCopernicusClientId,
    copernicusClientSecret,
    setCopernicusClientSecret,
    flags,
    updateFlag,
    handleSave,
    handleReprocess,
  }
}
