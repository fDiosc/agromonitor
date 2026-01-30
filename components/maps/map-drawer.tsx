'use client'

import { useEffect, useRef, useState } from 'react'
import { calculateSphericalArea } from '@/lib/services/geometry.service'
import { Loader2, Search, MapPin } from 'lucide-react'

interface MapDrawerProps {
  onGeometryChange: (geojson: string | null, areaHa: number, centroid: { lat: number; lng: number } | null) => void
  initialCenter?: [number, number]
  initialZoom?: number
}

interface SearchResult {
  display_name: string
  lat: string
  lon: string
  type: string
}

export function MapDrawer({ 
  onGeometryChange, 
  initialCenter = [-15.7801, -47.9292],
  initialZoom = 5 
}: MapDrawerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const drawnItemsRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const onGeometryChangeRef = useRef(onGeometryChange)
  const isInitializedRef = useRef(false)
  
  const [hasPolygon, setHasPolygon] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [drawnAreaHa, setDrawnAreaHa] = useState(0)

  // Manter ref atualizado sem causar re-render
  useEffect(() => {
    onGeometryChangeRef.current = onGeometryChange
  }, [onGeometryChange])

  // Inicializar mapa (apenas uma vez)
  useEffect(() => {
    if (!mapContainerRef.current || isInitializedRef.current) return
    isInitializedRef.current = true

    const loadLeaflet = async () => {
      try {
        const L = (await import('leaflet')).default
        await import('leaflet-draw')
        leafletRef.current = L

        // Fix default icons
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        if (!mapContainerRef.current) return

        // Create map
        const map = L.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          zoomControl: false
        })

        // Zoom control
        L.control.zoom({ position: 'topleft' }).addTo(map)

        // Camada base - Satélite ESRI
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Esri',
          maxZoom: 19
        }).addTo(map)

        // Camada de labels
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19
        }).addTo(map)

        // Camada de limites (linhas)
        L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          opacity: 0.4
        }).addTo(map)

        // Carregar estados brasileiros
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
            onEachFeature: (feature: any, layer: any) => {
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

        // Feature group para desenhos
        const drawnItems = new L.FeatureGroup()
        map.addLayer(drawnItems)
        drawnItemsRef.current = drawnItems

        // Função para processar geometria
        const processGeometry = (layer: any | null) => {
          if (!layer) {
            onGeometryChangeRef.current(null, 0, null)
            setHasPolygon(false)
            setDrawnAreaHa(0)
            return
          }

          try {
            const latlngs = layer.getLatLngs()[0]
            
            const coords: [number, number][] = latlngs.map((ll: any) => [ll.lng, ll.lat])
            if (coords.length > 0) {
              coords.push([coords[0][0], coords[0][1]])
            }

            const areaHa = calculateSphericalArea(coords)
            setDrawnAreaHa(areaHa)

            let sumLat = 0, sumLng = 0
            latlngs.forEach((ll: any) => {
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

        // Controle de desenho
        const drawControl = new (L.Control as any).Draw({
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
        map.addControl(drawControl)

        // Evento: Polígono criado
        map.on((L as any).Draw.Event.CREATED, (e: any) => {
          // Limpar desenhos anteriores
          drawnItems.clearLayers()
          
          // Adicionar novo layer
          const layer = e.layer
          drawnItems.addLayer(layer)
          
          // Processar geometria
          processGeometry(layer)
        })

        // Evento: Polígono editado
        map.on((L as any).Draw.Event.EDITED, (e: any) => {
          const layers = e.layers
          layers.eachLayer((layer: any) => {
            processGeometry(layer)
          })
        })

        // Evento: Polígono deletado
        map.on((L as any).Draw.Event.DELETED, () => {
          if (drawnItems.getLayers().length === 0) {
            processGeometry(null)
          }
        })

        // Escala
        L.control.scale({ 
          position: 'bottomleft',
          metric: true,
          imperial: false
        }).addTo(map)

        mapRef.current = map
        setIsLoaded(true)

        // Force resize
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
        mapRef.current.remove()
        mapRef.current = null
        isInitializedRef.current = false
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Array vazio - inicializar mapa apenas uma vez (initialCenter/Zoom são valores iniciais)

  // Busca
  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery
    if (!searchTerm.trim()) return

    setIsSearching(true)
    setShowResults(false)

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` + 
        `format=json&` +
        `q=${encodeURIComponent(searchTerm + ', Brasil')}&` +
        `countrycodes=br&` +
        `limit=5&` +
        `addressdetails=1`,
        {
          headers: {
            'User-Agent': 'MerxAgroMonitor/1.0',
            'Accept-Language': 'pt-BR'
          }
        }
      )
      const data = await response.json()

      if (data.length > 0) {
        setSearchResults(data)
        setShowResults(true)
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const selectLocation = (result: SearchResult) => {
    if (!mapRef.current) return

    const lat = parseFloat(result.lat)
    const lon = parseFloat(result.lon)

    let zoom = 14
    if (result.type === 'state') zoom = 7
    else if (result.type === 'city' || result.type === 'town') zoom = 12
    else if (result.type === 'village') zoom = 13

    mapRef.current.setView([lat, lon], zoom)
    setShowResults(false)
    setSearchQuery(result.display_name.split(',')[0])
  }

  const clearDrawing = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers()
      onGeometryChangeRef.current(null, 0, null)
      setHasPolygon(false)
      setDrawnAreaHa(0)
    }
  }

  // Fechar resultados ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.search-container')) {
        setShowResults(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <div className="space-y-4">
      {/* Barra de busca */}
      <div className="relative search-container" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value.length >= 3) {
                  handleSearch(e.target.value)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearch()
                }
              }}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder="Buscar cidade, estado ou região..."
              className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleSearch()
            }}
            disabled={isSearching || !isLoaded}
            className="h-11 px-6 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSearching ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <MapPin size={16} />
            )}
            Buscar
          </button>
        </div>

        {/* Resultados da busca */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-[1000] overflow-hidden">
            {searchResults.map((result, idx) => (
              <button
                type="button"
                key={idx}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  selectLocation(result)
                }}
                className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-b-0"
              >
                <div className="font-medium text-slate-700 text-sm">
                  {result.display_name.split(',')[0]}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {result.display_name.split(',').slice(1, 4).join(',')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mapa */}
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

      {/* Status e instruções */}
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

      {/* Dicas */}
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
