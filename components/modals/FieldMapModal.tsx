'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Map, Maximize2, Minimize2 } from 'lucide-react'

interface SiblingField {
  id: string
  name: string
  geometryJson: string
  isSelected: boolean // true = this is the main field being viewed
}

interface FieldMapModalProps {
  isOpen: boolean
  onClose: () => void
  geometryJson: string
  fieldName: string
  areaHa?: number | null
  // Optional: parent polygon (for subfield view)
  parentGeometry?: string | null
  // Optional: sibling subfields (for multi-polygon view)
  siblings?: SiblingField[]
}

export function FieldMapModal({ isOpen, onClose, geometryJson, fieldName, areaHa, parentGeometry, siblings }: FieldMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const isInitializedRef = useRef(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Initialize map when modal opens
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || isInitializedRef.current) return
    isInitializedRef.current = true

    const loadMap = async () => {
      try {
        const L = (await import('leaflet')).default

        // Inject Leaflet CSS if not already present
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link')
          link.id = 'leaflet-css'
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }

        if (!mapContainerRef.current) return

        // Create map
        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          attributionControl: true,
        })

        // Base layers
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        })

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Esri',
          maxZoom: 19,
        })

        // Add Satellite as the default active layer
        satelliteLayer.addTo(map)

        // Layer control (top-right) — Satellite first (default)
        L.control.layers(
          { 'Satélite': satelliteLayer, 'Mapa': osmLayer },
          {},
          { position: 'topright', collapsed: false }
        ).addTo(map)

        // Parse and add the GeoJSON polygon(s)
        try {
          // If parent geometry provided, draw it as dashed outline
          if (parentGeometry) {
            try {
              const parentData = JSON.parse(parentGeometry)
              L.geoJSON(parentData, {
                style: {
                  fillColor: '#94a3b8',
                  fillOpacity: 0.05,
                  color: '#94a3b8',
                  weight: 3,
                  dashArray: '8,6',
                },
              }).addTo(map)
            } catch { /* ignore parent parse error */ }
          }

          // If siblings provided, draw them
          if (siblings && siblings.length > 0) {
            const sibColors = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
            siblings.forEach((sib, idx) => {
              try {
                const sibData = JSON.parse(sib.geometryJson)
                L.geoJSON(sibData, {
                  style: sib.isSelected ? {
                    fillColor: '#10b981',
                    fillOpacity: 0.35,
                    color: '#059669',
                    weight: 3,
                  } : {
                    fillColor: sibColors[idx % sibColors.length],
                    fillOpacity: 0.15,
                    color: sibColors[idx % sibColors.length],
                    weight: 1.5,
                  },
                }).addTo(map).bindTooltip(sib.name, {
                  permanent: true,
                  direction: 'center',
                  className: 'subfield-tooltip',
                })
              } catch { /* ignore */ }
            })
          }

          // Main field polygon
          const geojsonData = JSON.parse(geometryJson)
          const geoJsonLayer = L.geoJSON(geojsonData, {
            style: {
              fillColor: '#10b981',
              fillOpacity: siblings ? 0.35 : 0.25,
              color: '#059669',
              weight: siblings ? 3 : 2,
            },
          }).addTo(map)

          // Fit to parent if available, otherwise to main polygon
          if (parentGeometry) {
            try {
              const parentBounds = L.geoJSON(JSON.parse(parentGeometry)).getBounds()
              if (parentBounds.isValid()) {
                map.fitBounds(parentBounds, { padding: [40, 40] })
              }
            } catch {
              const bounds = geoJsonLayer.getBounds()
              if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] })
            }
          } else {
            const bounds = geoJsonLayer.getBounds()
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [40, 40] })
            }
          }
        } catch (err) {
          console.error('Error parsing geometryJson:', err)
          // Fallback: center on Brazil
          map.setView([-15.78, -47.93], 5)
        }

        // Scale control
        L.control.scale({
          position: 'bottomleft',
          metric: true,
          imperial: false,
        }).addTo(map)

        mapRef.current = map
        setIsLoaded(true)

        // Force resize after render
        setTimeout(() => {
          map.invalidateSize()
        }, 150)
      } catch (error) {
        console.error('Failed to load Leaflet:', error)
      }
    }

    loadMap()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        isInitializedRef.current = false
        setIsLoaded(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Invalidate map size when fullscreen changes
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize()
      }, 200)
    }
  }, [isFullscreen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl mx-4 overflow-hidden flex flex-col transition-all duration-300 ${
          isFullscreen
            ? 'w-[95vw] h-[95vh] max-w-none'
            : 'max-w-4xl w-full max-h-[90vh]'
        }`}
      >
        {/* Header — z-10 to stay above Leaflet tile panes */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Map className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{fieldName}</h2>
              {areaHa && (
                <p className="text-xs text-slate-500">
                  Área: {areaHa.toFixed(1)} ha
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500"
              title={isFullscreen ? 'Reduzir' : 'Expandir'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative" style={{ minHeight: isFullscreen ? undefined : '500px' }}>
          <div
            ref={mapContainerRef}
            className="w-full h-full"
            style={{ minHeight: isFullscreen ? 'calc(95vh - 72px)' : '500px' }}
          >
            {!isLoaded && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-100">
                <Loader2 size={32} className="text-emerald-500 animate-spin" />
                <div className="text-slate-400 text-sm font-medium">
                  Carregando mapa...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
