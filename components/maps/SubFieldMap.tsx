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
  onDrawComplete
}: SubFieldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const parentLayerRef = useRef<any>(null)
  const subLayersRef = useRef<Record<string, any>>({})
  const drawControlRef = useRef<any>(null)
  const isInitializedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)

  // Keep callbacks in refs to avoid stale closures
  const onSelectRef = useRef(onSelect)
  const onDrawCompleteRef = useRef(onDrawComplete)
  const selectedIdRef = useRef(selectedId)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { onDrawCompleteRef.current = onDrawComplete }, [onDrawComplete])
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

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

    if (isDrawing) {
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

      // Listen for draw:created
      const handleCreated = (e: any) => {
        const layer = e.layer
        const geojson = layer.toGeoJSON()

        const featureCollection = {
          type: 'FeatureCollection',
          features: [geojson]
        }

        onDrawCompleteRef.current(JSON.stringify(featureCollection))
      }

      map.on(L.Draw.Event.CREATED, handleCreated)

      return () => {
        if (map && drawControlRef.current) {
          map.removeControl(drawControlRef.current)
          map.off(L.Draw.Event.CREATED, handleCreated)
          drawControlRef.current = null
        }
      }
    } else {
      if (drawControlRef.current && map) {
        map.removeControl(drawControlRef.current)
        drawControlRef.current = null
      }
    }
  }, [isDrawing, mapReady])

  return (
    <div
      ref={mapContainerRef}
      className="w-full"
      style={{ zIndex: 0, height: '500px' }}
    />
  )
}
