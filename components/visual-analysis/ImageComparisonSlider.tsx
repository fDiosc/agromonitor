'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { FieldPolygonOverlay } from './FieldPolygonOverlay'

interface ImageComparisonSliderProps {
  beforeImage: string // URL or base64 data URI
  afterImage: string  // URL or base64 data URI
  beforeDate: string
  afterDate: string
  beforeLabel?: string
  afterLabel?: string
  height?: number
  geometryJson?: string
  bbox?: [number, number, number, number]
}

export function ImageComparisonSlider({
  beforeImage,
  afterImage,
  beforeDate,
  afterDate,
  beforeLabel = 'Antes',
  afterLabel = 'Depois',
  height = 500,
  geometryJson,
  bbox,
}: ImageComparisonSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track container width with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPosition(percent)
  }, [])

  const handleMouseDown = () => setIsDragging(true)
  const handleMouseUp = () => setIsDragging(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX)
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) handleMove(e.touches[0].clientX)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleMouseUp)
    }
  }, [isDragging, handleMove])

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return d
    }
  }

  return (
    <div className="relative select-none" style={{ height }}>
      {/* Container */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden rounded-xl cursor-col-resize bg-slate-900"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        {/* After image (full width, below) */}
        <img
          src={afterImage}
          alt={afterLabel}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* Before image (clipped) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={beforeImage}
            alt={beforeLabel}
            className="absolute inset-0 h-full object-cover"
            style={{ width: containerWidth > 0 ? containerWidth : '100%' }}
            draggable={false}
          />
        </div>

        {/* Field polygon overlay */}
        {geometryJson && bbox && containerWidth > 0 && (
          <FieldPolygonOverlay
            geometryJson={geometryJson}
            bbox={bbox}
            width={containerWidth}
            height={height}
          />
        )}

        {/* Slider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* Handle */}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center cursor-col-resize">
            <ChevronLeft size={14} className="text-slate-600 -mr-1" />
            <ChevronRight size={14} className="text-slate-600 -ml-1" />
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-3 left-3 z-20">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
            <Calendar size={10} />
            {beforeLabel}: {formatDate(beforeDate)}
          </span>
        </div>
        <div className="absolute top-3 right-3 z-20">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
            <Calendar size={10} />
            {afterLabel}: {formatDate(afterDate)}
          </span>
        </div>
      </div>
    </div>
  )
}
