'use client'

import { useEffect, useRef, useState } from 'react'

interface SubFieldData {
  id: string
  name: string
  geometryJson: string
}

interface SubFieldMapProps {
  parentGeometry: string
  subFields: SubFieldData[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  isDrawing: boolean
  onDrawComplete: (geometryJson: string) => void
  /** ID do subtalhão sendo editado (arraste de vértices) */
  editingId?: string | null
  /** Callback quando edição de geometria é confirmada */
  onEditComplete?: (id: string, geometryJson: string) => void
  /** Callback quando edição é cancelada */
  onEditCancel?: () => void
}

// Cores para subtalhões
const SUB_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
]

export default function SubFieldMap({
  parentGeometry,
  subFields,
  selectedId,
  onSelect,
  isDrawing,
  onDrawComplete,
  editingId = null,
  onEditComplete,
  onEditCancel,
}: SubFieldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const parentLayerRef = useRef<any>(null)
  const subLayersRef = useRef<Record<string, any>>({})
  const drawControlRef = useRef<any>(null)
  const editableGroupRef = useRef<any>(null)
  const isInitializedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  // Polígono recém-desenhado aguardando confirmação (com edição de vértices)
  const [pendingDraw, setPendingDraw] = useState(false)
  const pendingLayerRef = useRef<any>(null)

  // Keep callbacks in refs to avoid stale closures
  const onSelectRef = useRef(onSelect)
  const onDrawCompleteRef = useRef(onDrawComplete)
  const onEditCompleteRef = useRef(onEditComplete)
  const onEditCancelRef = useRef(onEditCancel)
  const selectedIdRef = useRef(selectedId)
  const editingIdRef = useRef(editingId)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { onDrawCompleteRef.current = onDrawComplete }, [onDrawComplete])
  useEffect(() => { onEditCompleteRef.current = onEditComplete }, [onEditComplete])
  useEffect(() => { onEditCancelRef.current = onEditCancel }, [onEditCancel])
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  useEffect(() => { editingIdRef.current = editingId }, [editingId])

  // Initialize map once on mount
  useEffect(() => {
    if (!mapContainerRef.current || isInitializedRef.current) return
    isInitializedRef.current = true

    let mounted = true

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default
        await import('leaflet-draw')

        if (!mounted || !mapContainerRef.current) return

        leafletRef.current = L

        // Fix default icons
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        const map = L.map(mapContainerRef.current, {
          center: [-15.78, -47.93],
          zoom: 5,
          zoomControl: true,
          attributionControl: false,
        })

        // Satellite base layer
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19 }
        ).addTo(map)

        // Labels overlay
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19, opacity: 0.6 }
        ).addTo(map)

        mapRef.current = map
        setMapReady(true)

        // Force a resize after mount
        setTimeout(() => {
          if (map && mounted) map.invalidateSize()
        }, 300)

      } catch (err) {
        console.error('[SubFieldMap] Error initializing map:', err)
      }
    }

    initMap()

    return () => {
      mounted = false
      // Limpar layers editáveis antes de destruir o mapa
      if (editableGroupRef.current) {
        editableGroupRef.current = null
      }
      pendingLayerRef.current = null
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      leafletRef.current = null
      isInitializedRef.current = false
    }
  }, [])

  // Draw parent polygon (runs after map is ready)
  useEffect(() => {
    if (!mapReady) return
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map || !parentGeometry) return

    // Remove previous parent layer
    if (parentLayerRef.current) {
      map.removeLayer(parentLayerRef.current)
      parentLayerRef.current = null
    }

    try {
      const geojson = JSON.parse(parentGeometry)
      const parentLayer = L.geoJSON(geojson, {
        style: {
          color: '#94a3b8',
          weight: 3,
          fillOpacity: 0.05,
          fillColor: '#94a3b8',
          dashArray: '8,6'
        }
      }).addTo(map)
      parentLayerRef.current = parentLayer
      map.fitBounds(parentLayer.getBounds(), { padding: [30, 30] })
    } catch (err) {
      console.error('[SubFieldMap] Error parsing parent geometry:', err)
    }
  }, [parentGeometry, mapReady])

  // Draw sub-fields whenever they change
  useEffect(() => {
    if (!mapReady) return
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    // Clear existing sub-field layers
    Object.values(subLayersRef.current).forEach(layer => {
      map.removeLayer(layer)
    })
    subLayersRef.current = {}

    subFields.forEach((sf, idx) => {
      try {
        const geojson = JSON.parse(sf.geometryJson)
        const color = SUB_COLORS[idx % SUB_COLORS.length]
        const isSelected = sf.id === selectedIdRef.current

        const layer = L.geoJSON(geojson, {
          style: {
            color: isSelected ? '#ffffff' : color,
            weight: isSelected ? 4 : 2,
            fillOpacity: isSelected ? 0.4 : 0.2,
            fillColor: color,
          }
        })

        // Add label
        const center = layer.getBounds().getCenter()
        const label = L.marker(center, {
          icon: L.divIcon({
            className: 'subfield-label',
            html: `<div style="
              background: ${color};
              color: white;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              ${isSelected ? 'outline: 2px solid white;' : ''}
            ">${sf.name}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          })
        })

        const sfId = sf.id
        const group = L.layerGroup([layer, label])
        group.addEventListener('click', () => {
          onSelectRef.current(sfId === selectedIdRef.current ? null : sfId)
        })

        group.addTo(map)
        subLayersRef.current[sf.id] = group
      } catch { /* ignore invalid geometry */ }
    })
  }, [subFields, selectedId, mapReady])

  // Handle drawing mode
  useEffect(() => {
    if (!mapReady) return
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    if (isDrawing && !pendingDraw) {
      // Criar FeatureGroup editável se ainda não existe
      if (!editableGroupRef.current) {
        editableGroupRef.current = new L.FeatureGroup()
        map.addLayer(editableGroupRef.current)
      }

      // Add draw control
      const drawControl = new L.Control.Draw({
        draw: {
          polygon: {
            shapeOptions: {
              color: '#10b981',
              weight: 3,
              fillOpacity: 0.3,
            },
            allowIntersection: false,
            showArea: true,
          },
          polyline: false,
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
        edit: false
      })
      map.addControl(drawControl)
      drawControlRef.current = drawControl

      // Ao finalizar desenho: manter no mapa com vértices editáveis
      const handleCreated = (e: any) => {
        const layer = e.layer

        // Remover draw control (desenho único)
        if (drawControlRef.current) {
          map.removeControl(drawControlRef.current)
          drawControlRef.current = null
        }

        // Garantir que o grupo editável existe (defensive)
        if (!editableGroupRef.current) {
          editableGroupRef.current = new L.FeatureGroup()
          map.addLayer(editableGroupRef.current)
        }

        // Adicionar ao grupo editável
        editableGroupRef.current.addLayer(layer)
        pendingLayerRef.current = layer

        // Habilitar edição de vértices
        layer.editing.enable()

        setPendingDraw(true)
      }

      map.on(L.Draw.Event.CREATED, handleCreated)

      return () => {
        if (map && drawControlRef.current) {
          map.removeControl(drawControlRef.current)
          map.off(L.Draw.Event.CREATED, handleCreated)
          drawControlRef.current = null
        }
      }
    } else if (!isDrawing) {
      // Limpar tudo ao sair do modo desenho
      if (drawControlRef.current && map) {
        map.removeControl(drawControlRef.current)
        drawControlRef.current = null
      }
      cleanupEditable()
    }
  }, [isDrawing, mapReady, pendingDraw])

  // Handle editing existing subfield
  useEffect(() => {
    if (!mapReady) return
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    // Limpar edição anterior
    cleanupEditable()

    if (!editingId) return

    // Encontrar o subfield para editar
    const sf = subFields.find(s => s.id === editingId)
    if (!sf) return

    try {
      const geojson = JSON.parse(sf.geometryJson)

      // Criar FeatureGroup editável
      editableGroupRef.current = new L.FeatureGroup()
      map.addLayer(editableGroupRef.current)

      const editLayer = L.geoJSON(geojson, {
        style: {
          color: '#f59e0b',
          weight: 3,
          fillOpacity: 0.3,
          fillColor: '#f59e0b',
          dashArray: '4,4',
        }
      })

      // Adicionar cada layer individual ao grupo (para edição funcionar)
      editLayer.eachLayer((layer: any) => {
        if (editableGroupRef.current) {
          editableGroupRef.current.addLayer(layer)
          pendingLayerRef.current = layer
          layer.editing.enable()
        }
      })

      // Esconder o layer original do subfield
      if (subLayersRef.current[editingId]) {
        map.removeLayer(subLayersRef.current[editingId])
      }
    } catch (err) {
      console.error('[SubFieldMap] Error setting up edit mode:', err)
    }
  }, [editingId, mapReady, subFields])

  /** Confirmar desenho pendente (novo polígono) */
  const handleConfirmDraw = () => {
    if (!pendingLayerRef.current) return

    const geojson = pendingLayerRef.current.toGeoJSON()
    const featureCollection = {
      type: 'FeatureCollection',
      features: [geojson]
    }

    cleanupEditable()
    setPendingDraw(false)
    onDrawCompleteRef.current(JSON.stringify(featureCollection))
  }

  /** Cancelar desenho pendente */
  const handleCancelDraw = () => {
    cleanupEditable()
    setPendingDraw(false)
  }

  /** Confirmar edição de subfield existente */
  const handleConfirmEdit = () => {
    if (!pendingLayerRef.current || !editingIdRef.current) return

    const geojson = pendingLayerRef.current.toGeoJSON()
    const featureCollection = {
      type: 'FeatureCollection',
      features: [geojson]
    }

    const id = editingIdRef.current
    cleanupEditable()
    onEditCompleteRef.current?.(id, JSON.stringify(featureCollection))
  }

  /** Cancelar edição de subfield existente */
  const handleCancelEdit = () => {
    cleanupEditable()
    onEditCancelRef.current?.()
  }

  /** Limpar layers editáveis */
  function cleanupEditable() {
    const map = mapRef.current
    if (editableGroupRef.current && map) {
      editableGroupRef.current.eachLayer((layer: any) => {
        if (layer.editing) layer.editing.disable()
      })
      map.removeLayer(editableGroupRef.current)
      editableGroupRef.current = null
    }
    pendingLayerRef.current = null
  }

  const showOverlay = pendingDraw || !!editingId

  return (
    <div className="relative">
      <div
        ref={mapContainerRef}
        className="w-full"
        style={{ zIndex: 0, height: '500px' }}
      />

      {/* Overlay de confirmação: vértices editáveis */}
      {showOverlay && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border px-4 py-2">
          <span className="text-sm font-medium text-slate-700">
            {pendingDraw
              ? 'Ajuste os vértices e confirme'
              : 'Arraste os vértices para ajustar'}
          </span>
          <button
            onClick={pendingDraw ? handleConfirmDraw : handleConfirmEdit}
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-md hover:bg-emerald-700 transition-colors"
          >
            Confirmar
          </button>
          <button
            onClick={pendingDraw ? handleCancelDraw : handleCancelEdit}
            className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm font-semibold rounded-md hover:bg-slate-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
