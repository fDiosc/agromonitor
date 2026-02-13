'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ImageComparisonSlider } from './ImageComparisonSlider'
import { FieldPolygonOverlay } from './FieldPolygonOverlay'
import { ImageTypeToggle, CloudSlider, ThumbnailStrip, getCloudBadgeColor, formatImageDate } from './ImageControls'
import { useVisualAnalysisImages } from '@/hooks/useVisualAnalysisImages'
import {
  Loader2, Layers, AlertCircle, RefreshCw, ScanEye, Download,
  Calendar, Cloud, CloudRain, ImageIcon,
} from 'lucide-react'

type ImageTypeFilter = 'truecolor' | 'ndvi' | 'radar'

function MapPinIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

interface VisualAnalysisTabProps {
  fieldId: string
}

export function VisualAnalysisTab({ fieldId }: VisualAnalysisTabProps) {
  const {
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
  } = useVisualAnalysisImages(fieldId)

  const [imageType, setImageType] = useState<ImageTypeFilter>('truecolor')
  const [selectedDateIdx, setSelectedDateIdx] = useState(0)
  const [compareMode, setCompareMode] = useState(false)
  const [compareDateIdx, setCompareDateIdx] = useState(0)
  const [cloudThreshold, setCloudThreshold] = useState(100)
  const [showOverlay, setShowOverlay] = useState(true)

  // Filter by type
  const typeFilteredImages = useMemo(() => {
    return images.filter(img => img.type === imageType)
  }, [images, imageType])

  // Filter by cloud threshold
  const filteredImages = useMemo(() => {
    return typeFilteredImages.filter(img => {
      if (img.cloudCoverage === null || img.cloudCoverage === undefined) return true
      return img.cloudCoverage <= cloudThreshold
    })
  }, [typeFilteredImages, cloudThreshold])

  const filteredDates = useMemo(() => {
    const dateSet = new Set(filteredImages.map(img => img.date))
    return dates.filter(d => dateSet.has(d))
  }, [dates, filteredImages])

  const safeDateIdx = Math.min(selectedDateIdx, Math.max(0, filteredDates.length - 1))
  const safeCompareDateIdx = Math.min(compareDateIdx, Math.max(0, filteredDates.length - 1))

  const currentImage = filteredImages.find(img => img.date === filteredDates[safeDateIdx])
  const compareImage = compareMode
    ? filteredImages.find(img => img.date === filteredDates[safeCompareDateIdx])
    : null

  const hasRadar = useMemo(() => images.some(img => img.type === 'radar'), [images])

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

  const handleRefresh = async () => {
    await fetchImages(true)
    setSelectedDateIdx(0)
    setCompareDateIdx(0)
  }

  const handleSelectDate = (idx: number, target: 'primary' | 'compare') => {
    if (target === 'compare') setCompareDateIdx(idx)
    else setSelectedDateIdx(idx)
  }

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
          <ImageTypeToggle
            imageType={imageType}
            setImageType={setImageType}
            hasRadar={hasRadar}
          />

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
            onClick={handleRefresh}
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
      <CloudSlider
        cloudThreshold={cloudThreshold}
        setCloudThreshold={setCloudThreshold}
        typeFilteredImages={typeFilteredImages}
        filteredImages={filteredImages}
        imageType={imageType}
        cloudStats={cloudStats}
      />

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
                      {formatImageDate(currentImage.date)}
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

          <ThumbnailStrip
            filteredDates={filteredDates}
            filteredImages={filteredImages}
            imageType={imageType}
            selectedDateIdx={safeDateIdx}
            compareDateIdx={safeCompareDateIdx}
            compareMode={compareMode}
            onSelectDate={handleSelectDate}
          />
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
              onClick={handleRefresh}
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
