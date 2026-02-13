'use client'

import { useEffect, useRef, useState } from 'react'
import { calculateSphericalArea } from '@/lib/services/geometry.service'
import { Loader2 } from 'lucide-react'
import { useLocationSearch } from '@/hooks/useLocationSearch'
import { MapSearchBar } from './MapSearchBar'

interface MapDrawerProps {
  onGeometryChange: (geojson: string | null, areaHa: number, centroid: { lat: number; lng: number } | null) => void
  initialCenter?: [number, number]
  initialZoom?: number
}

export function MapDrawer({
  onGeometryChange,
  initialCenter = [-15.7801, -47.9292],
  initialZoom = 5
}: MapDrawerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)
  const drawnItemsRef = useRef<unknown>(null)
  const onGeometryChangeRef = useRef(onGeometryChange)
  const isInitializedRef = useRef(false)

  const [hasPolygon, setHasPolygon] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [drawnAreaHa, setDrawnAreaHa] = useState(0)

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    showResults,
    setShowResults,
    handleSearch,
  } = useLocationSearch()

  useEffect(() => {
    onGeometryChangeRef.current = onGeometryChange
  }, [onGeometryChange])

  useEffect(() => {
    if (!mapContainerRef.current || isInitializedRef.current) return
    isInitializedRef.current = true

    const loadLeaflet = async () => {
      try {
        const L = (await import('leaflet')).default
        await import('leaflet-draw')
        delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        if (!mapContainerRef.current) return

        const map = L.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          zoomControl: false
        })

        L.control.zoom({ position: 'topleft' }).addTo(map)

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Esri',
          maxZoom: 19
        }).addTo(map)

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19
        }).addTo(map)

        L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          opacity: 0.4
        }).addTo(map)

        try {
          const statesResponse = await fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson')
          const statesData = await statesResponse.json()

          L.geoJSON(statesData, {
            style: {
              color: '#ffffff',
              weight: 2,
              opacity: 0.7,
              fillOpacity: 0,
              dashArray: '5, 5'
            },
            onEachFeature: (feature: { properties?: { name?: string } }, layer: { bindTooltip: (text: string, opts: object) => void }) => {
              if (feature.properties?.name) {
                layer.bindTooltip(feature.properties.name, {
                  permanent: false,
                  direction: 'center',
                  className: 'state-label'
                })
              }
            }
          }).addTo(map)
        } catch (e) {
          console.warn('Could not load states boundaries:', e)
        }

        const drawnItems = new L.FeatureGroup()
        map.addLayer(drawnItems)
        drawnItemsRef.current = drawnItems

        const processGeometry = (layer: { getLatLngs: () => { 0: { lat: number; lng: number }[] } } | null) => {
          if (!layer) {
            onGeometryChangeRef.current(null, 0, null)
            setHasPolygon(false)
            setDrawnAreaHa(0)
            return
          }

          try {
            const latlngs = layer.getLatLngs()[0]

            const coords: [number, number][] = latlngs.map((ll: { lng: number; lat: number }) => [ll.lng, ll.lat])
            if (coords.length > 0) {
              coords.push([coords[0][0], coords[0][1]])
            }

            const areaHa = calculateSphericalArea(coords)
            setDrawnAreaHa(areaHa)

            let sumLat = 0, sumLng = 0
            latlngs.forEach((ll: { lat: number; lng: number }) => {
              sumLat += ll.lat
              sumLng += ll.lng
            })
            const centroid = {
              lat: sumLat / latlngs.length,
              lng: sumLng / latlngs.length
            }

            const geojson = {
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Polygon',
                  coordinates: [coords]
                }
              }]
            }

            onGeometryChangeRef.current(JSON.stringify(geojson), areaHa, centroid)
            setHasPolygon(true)
          } catch (error) {
            console.error('Error processing geometry:', error)
          }
        }

        const drawControl = new (L.Control as { Draw: new (opts: object) => unknown }).Draw({
          position: 'topright',
          draw: {
            polygon: {
              allowIntersection: false,
              drawError: {
                color: '#e74c3c',
                message: '<strong>Erro:</strong> Polígono não pode se cruzar!'
              },
              shapeOptions: {
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.3,
                weight: 3
              },
              showArea: true,
              metric: true
            },
            polyline: false,
            circle: false,
            rectangle: {
              shapeOptions: {
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.3,
                weight: 3
              }
            },
            marker: false,
            circlemarker: false
          },
          edit: {
            featureGroup: drawnItems,
            remove: true,
            edit: true
          }
        })
        map.addControl(drawControl as never)

        const DrawEvents = (L as { Draw: { Event: { CREATED: string; EDITED: string; DELETED: string } } }).Draw.Event
        ;(map.on as (ev: string, fn: (e: unknown) => void) => void)(DrawEvents.CREATED, (e: unknown) => {
          const ev = e as { layer: { getLatLngs: () => { 0: { lat: number; lng: number }[] } } }
          drawnItems.clearLayers()
          drawnItems.addLayer(ev.layer as never)
          processGeometry(ev.layer)
        })

        ;(map.on as (ev: string, fn: (e: unknown) => void) => void)(DrawEvents.EDITED, (e: unknown) => {
          const ev = e as { layers: { eachLayer: (cb: (l: unknown) => void) => void } }
          ev.layers.eachLayer((layer: unknown) => {
            processGeometry(layer as { getLatLngs: () => { 0: { lat: number; lng: number }[] } })
          })
        })

        ;(map.on as (ev: string, fn: () => void) => void)(DrawEvents.DELETED, () => {
          if (drawnItems.getLayers().length === 0) {
            processGeometry(null)
          }
        })

        L.control.scale({
          position: 'bottomleft',
          metric: true,
          imperial: false
        }).addTo(map)

        mapRef.current = map
        setIsLoaded(true)

        setTimeout(() => {
          map.invalidateSize()
        }, 100)

      } catch (error) {
        console.error('Failed to load Leaflet:', error)
      }
    }

    loadLeaflet()

    return () => {
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove()
        mapRef.current = null
        isInitializedRef.current = false
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectLocation = (result: { lat: string; lon: string; display_name: string; type?: string }) => {
    const map = mapRef.current as { setView: (center: [number, number], zoom: number) => void } | null
    if (!map) return

    const lat = parseFloat(result.lat)
    const lon = parseFloat(result.lon)

    let zoom = 14
    const type = result.type
    if (type === 'state') zoom = 7
    else if (type === 'city' || type === 'town') zoom = 12
    else if (type === 'village') zoom = 13

    map.setView([lat, lon], zoom)
    setShowResults(false)
    setSearchQuery(result.display_name.split(',')[0])
  }

  const clearDrawing = () => {
    const drawnItems = drawnItemsRef.current as { clearLayers: () => void } | null
    if (drawnItems) {
      drawnItems.clearLayers()
      onGeometryChangeRef.current(null, 0, null)
      setHasPolygon(false)
      setDrawnAreaHa(0)
    }
  }

  return (
    <div className="space-y-4">
      <MapSearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearching={isSearching}
        searchResults={searchResults}
        showResults={showResults}
        setShowResults={setShowResults}
        isLoaded={isLoaded}
        onSearch={handleSearch}
        onSelectResult={selectLocation}
      />

      <div
        ref={mapContainerRef}
        className="w-full h-[450px] rounded-[24px] overflow-hidden border-4 border-slate-100 shadow-lg bg-slate-200"
        style={{ minHeight: '450px' }}
      >
        {!isLoaded && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="text-emerald-500 animate-spin" />
            <div className="text-slate-400 text-sm font-medium">
              Carregando mapa...
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className={`text-sm font-medium transition-colors ${hasPolygon ? 'text-emerald-600' : 'text-slate-400'}`}>
          {!isLoaded ? (
            'Aguarde o carregamento do mapa...'
          ) : hasPolygon ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Talhão desenhado: {drawnAreaHa.toFixed(1)} ha
            </span>
          ) : (
            'Clique no ícone de polígono (⬠) no canto superior direito para desenhar'
          )}
        </div>

        {hasPolygon && (
          <button
            type="button"
            onClick={clearDrawing}
            className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            Limpar desenho
          </button>
        )}
      </div>

      {isLoaded && !hasPolygon && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-700 font-medium">
            <strong>Dicas:</strong> Use a busca para encontrar a região do talhão.
            Depois, clique no ícone de polígono e desenhe os limites clicando nos vértices.
            Clique no primeiro ponto para fechar o polígono.
          </p>
        </div>
      )}
    </div>
  )
}
