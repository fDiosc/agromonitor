'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { Field } from '@/components/fields/field-table'

interface LogisticsUnit {
  id: string
  name: string
}

interface Producer {
  id: string
  name: string
}

export function useDashboardFields() {
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [producers, setProducers] = useState<Producer[]>([])
  const [logisticsUnits, setLogisticsUnits] = useState<LogisticsUnit[]>([])
  const [enableSubFields, setEnableSubFields] = useState(false)

  const fetchFields = useCallback(async () => {
    try {
      const res = await fetch('/api/fields')
      const data = await res.json()
      setFields(data.fields || [])

      const hasProcessing = data.fields?.some((f: Field) => f.status === 'PROCESSING')

      if (hasProcessing && !pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(() => {
          fetchFields()
        }, 5000)
      }

      if (!hasProcessing && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    } catch (error) {
      console.error('Error fetching fields:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLogisticsUnits = useCallback(async () => {
    try {
      const res = await fetch('/api/logistics-units')
      if (res.ok) {
        const data = await res.json()
        setLogisticsUnits(data.logisticsUnits || [])
      }
    } catch (error) {
      console.error('Error fetching logistics units:', error)
    }
  }, [])

  const fetchProducers = useCallback(async () => {
    try {
      const res = await fetch('/api/producers')
      if (res.ok) {
        const data = await res.json()
        setProducers(data.producers?.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) || [])
      }
    } catch (error) {
      console.error('Error fetching producers:', error)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/workspace/settings')
      if (res.ok) {
        const data = await res.json()
        setEnableSubFields(data.featureFlags?.enableSubFields === true)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }, [])

  useEffect(() => {
    fetchFields()
    fetchLogisticsUnits()
    fetchProducers()
    fetchSettings()

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este talhão?')) return

    setDeleting(id)
    try {
      await fetch(`/api/fields/${id}`, { method: 'DELETE' })
      setFields(prev => prev
        .filter(f => f.id !== id)
        .map(f => f.subFields ? {
          ...f,
          subFields: f.subFields.filter(sf => sf.id !== id),
          _count: f._count ? { subFields: Math.max(0, (f._count.subFields || 0) - (f.subFields.some(sf => sf.id === id) ? 1 : 0)) } : f._count
        } : f)
      )
    } catch (error) {
      console.error('Error deleting field:', error)
      alert('Erro ao excluir talhão')
    } finally {
      setDeleting(null)
    }
  }, [])

  const handleReprocess = useCallback(async (id: string) => {
    if (!confirm('Reprocessar irá buscar novos dados e recalcular análises. Continuar?')) return

    setReprocessing(id)

    setFields(prev => prev.map(f => {
      if (f.id === id) return { ...f, status: 'PROCESSING' }
      if (f.subFields?.some(sf => sf.id === id)) {
        return { ...f, subFields: f.subFields.map(sf => sf.id === id ? { ...sf, status: 'PROCESSING' } : sf) }
      }
      return f
    }))

    fetch(`/api/fields/${id}/process`, { method: 'POST' })
      .catch(err => console.log('Process request sent:', err.message))

    setTimeout(() => {
      setReprocessing(null)
    }, 3000)
  }, [])

  const filteredFields = useMemo(() => {
    const now = Date.now()
    const DAY = 86400000

    return (searchQuery: string, subFieldFilter: string, statusFilter: string, logisticsUnitFilter: string,
      assignmentTypeFilter: string, cropPatternFilter: string, aiFilter: string, aiAgreementFilter: string,
      confidenceFilter: string, harvestWindowFilter: string) => {
      const query = searchQuery.trim().toLowerCase()

      return fields.filter(field => {
        if (query) {
          const nameMatch = field.name?.toLowerCase().includes(query)
          const producerMatch = field.producer?.name?.toLowerCase().includes(query)
          const cityMatch = field.city?.toLowerCase().includes(query)
          if (!nameMatch && !producerMatch && !cityMatch) return false
        }

        if (subFieldFilter !== 'all') {
          const hasSub = (field._count?.subFields ?? field.subFields?.length ?? 0) > 0
          if (subFieldFilter === 'yes' && !hasSub) return false
          if (subFieldFilter === 'no' && hasSub) return false
        }

        if (statusFilter !== 'all' && field.status !== statusFilter) return false

        const directUnit = field.logisticsUnit?.id
        const inheritedUnit = field.producer?.defaultLogisticsUnit?.id
        const coveringUnits = field.logisticsDistances?.map(d => d.logisticsUnit.id) || []

        if (assignmentTypeFilter !== 'all') {
          if (assignmentTypeFilter === 'manual' && !directUnit) return false
          if (assignmentTypeFilter === 'producer' && (directUnit || !inheritedUnit)) return false
          if (assignmentTypeFilter === 'auto' && (directUnit || inheritedUnit || coveringUnits.length === 0)) return false
          if (assignmentTypeFilter === 'none' && (directUnit || inheritedUnit || coveringUnits.length > 0)) return false
        }

        if (logisticsUnitFilter !== 'all') {
          if (logisticsUnitFilter === 'none') {
            if (directUnit || inheritedUnit || coveringUnits.length > 0) return false
          } else {
            if (directUnit !== logisticsUnitFilter && inheritedUnit !== logisticsUnitFilter && !coveringUnits.includes(logisticsUnitFilter)) return false
          }
        }

        if (cropPatternFilter !== 'all') {
          const cp = field.agroData?.cropPatternStatus
          if (cropPatternFilter === 'problem' && (cp === 'TYPICAL' || !cp)) return false
          if (cropPatternFilter === 'NO_CROP' && cp !== 'NO_CROP') return false
          if (cropPatternFilter === 'ANOMALOUS' && cp !== 'ANOMALOUS') return false
          if (cropPatternFilter === 'ATYPICAL' && cp !== 'ATYPICAL') return false
          if (cropPatternFilter === 'TYPICAL' && cp !== 'TYPICAL') return false
        }

        const hasAi = !!field.agroData?.aiValidationAgreement
        if (aiFilter === 'with_ai' && !hasAi) return false
        if (aiFilter === 'without_ai' && hasAi) return false

        if (aiAgreementFilter !== 'all') {
          if (field.agroData?.aiValidationAgreement !== aiAgreementFilter) return false
        }

        if (confidenceFilter !== 'all') {
          const cs = field.agroData?.confidenceScore
          if (confidenceFilter === 'high' && (cs == null || cs < 75)) return false
          if (confidenceFilter === 'medium' && (cs == null || cs < 40 || cs >= 75)) return false
          if (confidenceFilter === 'low' && (cs == null || cs >= 40)) return false
          if (confidenceFilter === 'none' && cs != null) return false
        }

        if (harvestWindowFilter !== 'all') {
          const eosStr = field.agroData?.fusedEosDate || field.agroData?.eosDate
          if (!eosStr) {
            if (harvestWindowFilter !== 'no_data') return false
          } else {
            const eosMs = new Date(eosStr).getTime()
            const diff = eosMs - now
            if (harvestWindowFilter === 'past' && diff >= 0) return false
            if (harvestWindowFilter === 'next30' && (diff < 0 || diff > 30 * DAY)) return false
            if (harvestWindowFilter === 'next60' && (diff < 0 || diff > 60 * DAY)) return false
            if (harvestWindowFilter === 'next90' && (diff < 0 || diff > 90 * DAY)) return false
            if (harvestWindowFilter === 'no_data') return false
          }
        }

        return true
      })
    }
  }, [fields])

  return {
    fields,
    loading,
    deleting,
    reprocessing,
    producers,
    logisticsUnits,
    enableSubFields,
    fetchFields,
    handleDelete,
    handleReprocess,
  }
}
