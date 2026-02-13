'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SatImage {
  id: string
  date: string
  type: string
  collection: string
  url: string
  s3Key: string
  cloudCoverage: number | null
}

export interface UseVisualAnalysisImagesResult {
  images: SatImage[]
  dates: string[]
  loading: boolean
  refreshing: boolean
  error: string | null
  totalCount: number
  newCount: number
  geometryJson: string | null
  bbox: [number, number, number, number] | null
  fetchImages: (refresh?: boolean) => Promise<void>
}

export function useVisualAnalysisImages(fieldId: string): UseVisualAnalysisImagesResult {
  const [images, setImages] = useState<SatImage[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [geometryJson, setGeometryJson] = useState<string | null>(null)
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null)

  const fetchImages = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const url = `/api/fields/${fieldId}/images${refresh ? '?refresh=true' : ''}`
      const res = await fetch(url)

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao buscar imagens')
        return
      }

      const data = await res.json()
      setImages(data.images || [])
      setDates(data.dates || [])
      setTotalCount(data.totalCount || 0)
      setNewCount(data.newCount || 0)
      if (data.geometryJson) setGeometryJson(data.geometryJson)
      if (data.bbox) setBbox(data.bbox)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar imagens')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fieldId])

  // Fetch stored images on mount (no refresh)
  useEffect(() => {
    fetchImages(false)
  }, [fetchImages])

  return {
    images,
    dates,
    loading,
    refreshing,
    error,
    totalCount,
    newCount,
    geometryJson,
    bbox,
    fetchImages,
  }
}
