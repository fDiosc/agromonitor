'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ImageComparisonSlider } from './ImageComparisonSlider'
import { FieldPolygonOverlay } from './FieldPolygonOverlay'
import {
  Loader2, ChevronLeft, ChevronRight,
  Calendar, Cloud, Layers, AlertCircle, ImageIcon,
  RefreshCw, ScanEye, Download, CloudRain,
} from 'lucide-react'

// ==================== Types ====================

interface SatImage {
  id: string
  date: string
  type: string
  collection: string
  url: string
  s3Key: string
  cloudCoverage: number | null
}

interface VisualAnalysisTabProps {
  fieldId: string
}

type ImageTypeFilter = 'truecolor' | 'ndvi' | 'radar'

// ==================== Component ====================

export function VisualAnalysisTab({ fieldId }: VisualAnalysisTabProps) {
  const [images, setImages] = useState<SatImage[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [newCount, setNewCount] = useState(0)

  // Geometry for polygon overlay
  const [geometryJson, setGeometryJson] = useState<string | null>(null)
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null)
  const [showOverlay, setShowOverlay] = useState(true)

  // View state
  const [imageType, setImageType] = useState<ImageTypeFilter>('truecolor')
  const [selectedDateIdx, setSelectedDateIdx] = useState(0)
  const [compareMode, setCompareMode] = useState(false)
  const [compareDateIdx, setCompareDateIdx] = useState(0)

  // Cloud filter
  const [cloudThreshold, setCloudThreshold] = useState(100) // 0-100, show images with cloud <= threshold

  // ==================== Data Fetching ====================

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

      // Reset indices when data changes
      if (refresh) {
        setSelectedDateIdx(0)
        setCompareDateIdx(0)
      }
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

  // ==================== Derived State ====================

  // Filter by type
  const typeFilteredImages = useMemo(() => {
    return images.filter(img => img.type === imageType)
  }, [images, imageType])

  // Filter by cloud threshold
  const filteredImages = useMemo(() => {
    return typeFilteredImages.filter(img => {
      if (img.cloudCoverage === null || img.cloudCoverage === undefined) return true // show if no data
      return img.cloudCoverage <= cloudThreshold
    })
  }, [typeFilteredImages, cloudThreshold])

  // Filtered dates (only dates that have at least one image after cloud filter)
  const filteredDates = useMemo(() => {
    const dateSet = new Set(filteredImages.map(img => img.date))
    return dates.filter(d => dateSet.has(d))
  }, [dates, filteredImages])

  // Ensure selectedDateIdx is within bounds
  const safeDateIdx = Math.min(selectedDateIdx, Math.max(0, filteredDates.length - 1))
  const safeCompareDateIdx = Math.min(compareDateIdx, Math.max(0, filteredDates.length - 1))

  const currentImage = filteredImages.find(img => img.date === filteredDates[safeDateIdx])
  const compareImage = compareMode
    ? filteredImages.find(img => img.date === filteredDates[safeCompareDateIdx])
    : null

  // Check if radar images are available
  const hasRadar = useMemo(() => images.some(img => img.type === 'radar'), [images])

  // Cloud coverage stats
  const cloudStats = useMemo(() => {
    const withCloud = typeFilteredImages.filter(img => img.cloudCoverage !== null && img.cloudCoverage !== undefined)
    if (withCloud.length === 0) return null
    return {
      count: withCloud.length,
      min: Math.min(...withCloud.map(img => img.cloudCoverage!)),
      max: Math.max(...withCloud.map(img => img.cloudCoverage!)),
      avg: Math.round(withCloud.reduce((s, img) => s + img.cloudCoverage!, 0) / withCloud.length),
    }
  }, [typeFilteredImages])

  // ==================== Helpers ====================

  const formatDate = (d: string) => {
    try {
      return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    } catch {
      return d
    }
  }

  const getCloudBadgeColor = (cc: number | null | undefined): string => {
    if (cc === null || cc === undefined) return 'bg-slate-100 text-slate-500'
    if (cc <= 10) return 'bg-emerald-100 text-emerald-700'
    if (cc <= 30) return 'bg-yellow-100 text-yellow-700'
    if (cc <= 60) return 'bg-orange-100 text-orange-700'
    return 'bg-red-100 text-red-700'
  }

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ScanEye size={20} className="text-blue-600" />
            Imagens de Satélite
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {totalCount > 0
              ? `${totalCount} imagens armazenadas`
              : 'Nenhuma imagem armazenada. Clique em "Buscar novas imagens" para iniciar.'
            }
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Image type toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setImageType('truecolor')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                imageType === 'truecolor' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              Cor Real
            </button>
            <button
              onClick={() => setImageType('ndvi')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                imageType === 'ndvi' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'
              }`}
            >
              NDVI
            </button>
            {hasRadar && (
              <button
                onClick={() => setImageType('radar')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  imageType === 'radar' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500'
                }`}
              >
                Radar
              </button>
            )}
          </div>

          {/* Compare toggle */}
          <Button
            variant={compareMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setCompareMode(!compareMode)
              if (!compareMode && filteredDates.length > 1) {
                setCompareDateIdx(Math.min(filteredDates.length - 1, safeDateIdx + 1))
              }
            }}
            disabled={filteredDates.length < 2}
          >
            <Layers size={14} className="mr-1" />
            Comparar
          </Button>

          {/* Overlay toggle */}
          {geometryJson && bbox && (
            <Button
              variant={showOverlay ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowOverlay(!showOverlay)}
              className={showOverlay ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
            >
              <MapPinIcon size={14} className="mr-1" />
              Talhão
            </Button>
          )}

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchImages(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <><Loader2 size={14} className="mr-1 animate-spin" /> Buscando...</>
            ) : (
              <><RefreshCw size={14} className="mr-1" /> Buscar novas imagens</>
            )}
          </Button>
        </div>
      </div>

      {/* Cloud coverage filter */}
      {cloudStats && imageType !== 'radar' && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
                <Cloud size={14} className="text-slate-400" />
                <span className="font-medium">Nuvem max:</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={cloudThreshold}
                onChange={(e) => setCloudThreshold(Number(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-xs font-mono font-bold text-slate-700 w-10 text-right">
                {cloudThreshold}%
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">
                {filteredImages.length}/{typeFilteredImages.length} imagens
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Refreshing overlay */}
      {refreshing && (
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-xl text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-blue-700">Buscando novas imagens de satélite...</p>
          <p className="text-xs text-blue-500 mt-1">
            Apenas imagens de datas ainda não armazenadas serão buscadas
          </p>
        </div>
      )}

      {/* New images notification */}
      {newCount > 0 && !refreshing && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
          <Download size={16} className="text-emerald-600" />
          <span className="text-sm text-emerald-700 font-medium">
            {newCount} nova{newCount > 1 ? 's' : ''} imagem{newCount > 1 ? 'ns' : ''} armazenada{newCount > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Image viewer */}
      {!refreshing && filteredDates.length > 0 && (
        <>
          {/* Comparison slider or single image */}
          {compareMode && currentImage && compareImage ? (
            <ImageComparisonSlider
              beforeImage={currentImage.url}
              afterImage={compareImage.url}
              beforeDate={currentImage.date}
              afterDate={compareImage.date}
              height={500}
              geometryJson={showOverlay ? geometryJson || undefined : undefined}
              bbox={showOverlay ? bbox || undefined : undefined}
            />
          ) : currentImage ? (
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-xl">
                <div className="relative">
                  <img
                    src={currentImage.url}
                    alt={`${imageType} - ${currentImage.date}`}
                    className="w-full h-[500px] object-cover bg-slate-900"
                  />
                  {/* Polygon overlay */}
                  {showOverlay && geometryJson && bbox && (
                    <FieldPolygonOverlay
                      geometryJson={geometryJson}
                      bbox={bbox}
                      width={512}
                      height={500}
                    />
                  )}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black/60 text-white text-sm font-medium backdrop-blur-sm">
                      <Calendar size={12} />
                      {formatDate(currentImage.date)}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                    {currentImage.cloudCoverage !== null && currentImage.cloudCoverage !== undefined && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium backdrop-blur-sm ${getCloudBadgeColor(currentImage.cloudCoverage)}`}>
                        <Cloud size={10} />
                        {currentImage.cloudCoverage.toFixed(0)}%
                      </span>
                    )}
                    <Badge variant="outline" className="bg-black/60 text-white border-white/20 backdrop-blur-sm">
                      {imageType === 'truecolor' ? 'Cor Real' : imageType === 'ndvi' ? 'NDVI' : 'Radar'} | {currentImage.collection}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Sem imagem disponível para esta data</p>
              </CardContent>
            </Card>
          )}

          {/* Thumbnail strip */}
          <Card>
            <CardContent className="py-3">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {filteredDates.map((date, idx) => {
                  const img = filteredImages.find(i => i.date === date)
                  const isCurrent = idx === safeDateIdx
                  const isCompare = compareMode && idx === safeCompareDateIdx

                  return (
                    <button
                      key={date}
                      onClick={() => {
                        if (compareMode && idx !== safeDateIdx) {
                          setCompareDateIdx(idx)
                        } else {
                          setSelectedDateIdx(idx)
                        }
                      }}
                      className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                        isCurrent ? 'border-blue-600 ring-2 ring-blue-200' :
                        isCompare ? 'border-amber-500 ring-2 ring-amber-200' :
                        'border-slate-200 hover:border-slate-400'
                      }`}
                      title={`${formatDate(date)}${isCurrent ? ' (selecionado)' : ''}${isCompare ? ' (comparação)' : ''}${img?.cloudCoverage !== null && img?.cloudCoverage !== undefined ? ` | Nuvem: ${img.cloudCoverage.toFixed(0)}%` : ''}`}
                    >
                      <div className="relative w-[72px] h-[54px]">
                        {img ? (
                          <img
                            src={img.url}
                            alt={date}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                            <ImageIcon size={14} className="text-slate-300" />
                          </div>
                        )}
                        {/* Cloud badge on thumbnail */}
                        {img?.cloudCoverage !== null && img?.cloudCoverage !== undefined && (
                          <div className={`absolute top-0.5 right-0.5 px-1 py-0.5 rounded text-[8px] font-bold leading-none ${getCloudBadgeColor(img.cloudCoverage)}`}>
                            {img.cloudCoverage.toFixed(0)}%
                          </div>
                        )}
                        {/* Date label */}
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[8px] text-center py-0.5 leading-none font-medium">
                          {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded border-2 border-blue-600" /> Selecionado
                </span>
                {compareMode && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded border-2 border-amber-500" /> Comparação
                  </span>
                )}
                <span className="ml-auto">
                  {filteredDates.length} datas | {filteredImages.length} imagens ({imageType === 'truecolor' ? 'cor real' : imageType === 'ndvi' ? 'NDVI' : 'radar'})
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* No images at all */}
      {!refreshing && filteredDates.length === 0 && dates.length === 0 && !error && (
        <Card>
          <CardContent className="py-16 text-center">
            <ImageIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-600">Sem imagens armazenadas</h3>
            <p className="text-sm text-slate-400 mt-1 mb-4">
              Clique no botão abaixo para buscar imagens de satélite para este talhão.
              As imagens buscadas ficam salvas e compartilhadas com a análise por IA.
            </p>
            <Button
              onClick={() => fetchImages(true)}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw size={16} />
              Buscar imagens de satélite
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cloud filter removed all images */}
      {!refreshing && filteredDates.length === 0 && dates.length > 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <CloudRain className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-600">Nenhuma imagem abaixo de {cloudThreshold}% de nuvem</h3>
            <p className="text-sm text-slate-400 mt-1">
              Ajuste o slider de nuvem para ver mais imagens.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Small inline map pin icon to avoid extra import
function MapPinIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
