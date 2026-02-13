'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Cloud, ImageIcon } from 'lucide-react'
import type { SatImage } from '@/hooks/useVisualAnalysisImages'

export type ImageTypeFilter = 'truecolor' | 'ndvi' | 'radar'

/** Type toggle (Cor Real / NDVI / Radar) - use in header */
export function ImageTypeToggle({
  imageType,
  setImageType,
  hasRadar,
}: {
  imageType: ImageTypeFilter
  setImageType: (t: ImageTypeFilter) => void
  hasRadar: boolean
}) {
  return (
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
  )
}

/** Cloud coverage slider - use below header */
export function CloudSlider({
  cloudThreshold,
  setCloudThreshold,
  typeFilteredImages,
  filteredImages,
  imageType,
  cloudStats,
}: {
  cloudThreshold: number
  setCloudThreshold: (v: number) => void
  typeFilteredImages: SatImage[]
  filteredImages: SatImage[]
  imageType: ImageTypeFilter
  cloudStats: { count: number; min: number; max: number; avg: number } | null
}) {
  if (!cloudStats || imageType === 'radar') return null
  return (
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
  )
}

/** Thumbnail strip - use after image viewer */
export function ThumbnailStrip({
  filteredDates,
  filteredImages,
  imageType,
  selectedDateIdx,
  compareDateIdx,
  compareMode,
  onSelectDate,
}: {
  filteredDates: string[]
  filteredImages: SatImage[]
  imageType: ImageTypeFilter
  selectedDateIdx: number
  compareDateIdx: number
  compareMode: boolean
  onSelectDate: (idx: number, target: 'primary' | 'compare') => void
}) {
  if (filteredDates.length === 0) return null
  const safeDateIdx = Math.min(selectedDateIdx, Math.max(0, filteredDates.length - 1))
  const safeCompareDateIdx = Math.min(compareDateIdx, Math.max(0, filteredDates.length - 1))

  return (
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
                onClick={() => onSelectDate(idx, compareMode && idx !== safeDateIdx ? 'compare' : 'primary')}
                className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                  isCurrent ? 'border-blue-600 ring-2 ring-blue-200' :
                  isCompare ? 'border-amber-500 ring-2 ring-amber-200' :
                  'border-slate-200 hover:border-slate-400'
                }`}
                title={`${formatImageDate(date)}${isCurrent ? ' (selecionado)' : ''}${isCompare ? ' (comparação)' : ''}${img?.cloudCoverage !== null && img?.cloudCoverage !== undefined ? ` | Nuvem: ${img.cloudCoverage.toFixed(0)}%` : ''}`}
              >
                <div className="relative w-[72px] h-[54px]">
                  {img ? (
                    <img src={img.url} alt={date} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <ImageIcon size={14} className="text-slate-300" />
                    </div>
                  )}
                  {img?.cloudCoverage != null && (
                    <div className={`absolute top-0.5 right-0.5 px-1 py-0.5 rounded text-[8px] font-bold leading-none ${getCloudBadgeColor(img.cloudCoverage)}`}>
                      {img.cloudCoverage.toFixed(0)}%
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[8px] text-center py-0.5 leading-none font-medium">
                    {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
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
  )
}

export function getCloudBadgeColor(cc: number | null | undefined): string {
  if (cc === null || cc === undefined) return 'bg-slate-100 text-slate-500'
  if (cc <= 10) return 'bg-emerald-100 text-emerald-700'
  if (cc <= 30) return 'bg-yellow-100 text-yellow-700'
  if (cc <= 60) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

export function formatImageDate(d: string): string {
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return d
  }
}

