'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Warehouse } from 'lucide-react'
import dynamic from 'next/dynamic'

interface Field {
  id: string
  name: string
  city: string
  state: string
  areaHa: number
  volumeKg: number
  harvestStart: string
  harvestEnd: string
  status: 'harvesting' | 'upcoming' | 'attention' | 'waiting'
  riskLevel: 'low' | 'medium' | 'high'
  latitude: number
  longitude: number
  daysToHarvest: number
}

interface LogisticsUnit {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  coverageRadiusKm: number | null
  city?: string
  state?: string
}

interface PropertiesMapProps {
  fields: Field[]
  logisticsUnits?: LogisticsUnit[]
}

const statusColors = {
  harvesting: '#10b981', // green
  upcoming: '#f59e0b',   // amber
  attention: '#ef4444',  // red
  waiting: '#94a3b8'     // slate
}

const statusLabels = {
  harvesting: 'Colhendo',
  upcoming: 'Próximo',
  attention: 'Atenção',
  waiting: 'Aguardando'
}

// Dynamically import Leaflet components (client-side only)
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
)

const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
)

const CircleMarker = dynamic(
  () => import('react-leaflet').then(mod => mod.CircleMarker),
  { ssr: false }
)

const Polygon = dynamic(
  () => import('react-leaflet').then(mod => mod.Polygon),
  { ssr: false }
)

const Circle = dynamic(
  () => import('react-leaflet').then(mod => mod.Circle),
  { ssr: false }
)

const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
)

// Gera os pontos de um triângulo ao redor de um centro
function getTrianglePoints(lat: number, lng: number, sizeKm: number = 5): [number, number][] {
  // Converter km para graus (aproximado)
  const latOffset = sizeKm / 111
  const lngOffset = sizeKm / (111 * Math.cos(lat * Math.PI / 180))
  
  return [
    [lat + latOffset, lng], // Topo
    [lat - latOffset * 0.5, lng - lngOffset * 0.866], // Inferior esquerdo
    [lat - latOffset * 0.5, lng + lngOffset * 0.866], // Inferior direito
  ]
}

function MapContent({ fields, logisticsUnits = [] }: { fields: Field[]; logisticsUnits?: LogisticsUnit[] }) {
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
    // Leaflet CSS is already imported in layout.tsx via CDN
  }, [])

  if (!isClient) {
    return (
      <div className="h-[400px] bg-slate-900/50 rounded-lg flex items-center justify-center">
        <p className="text-slate-400">Carregando mapa...</p>
      </div>
    )
  }

  // Filter fields with valid coordinates
  const validFields = fields.filter(f => f.latitude !== 0 && f.longitude !== 0)
  const validUnits = logisticsUnits.filter(u => u.latitude !== null && u.longitude !== null)
  
  if (validFields.length === 0 && validUnits.length === 0) {
    return (
      <div className="h-[400px] bg-slate-900/50 rounded-lg flex items-center justify-center">
        <p className="text-slate-400">Nenhum talhão ou caixa logística com coordenadas válidas</p>
      </div>
    )
  }

  // Calculate center considering both fields and units
  const allPoints = [
    ...validFields.map(f => ({ lat: f.latitude, lng: f.longitude })),
    ...validUnits.map(u => ({ lat: u.latitude!, lng: u.longitude! }))
  ]
  const centerLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length
  const centerLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length

  return (
    <div className="h-[400px] rounded-lg overflow-hidden">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Círculos de cobertura das caixas logísticas */}
        {validUnits.map((unit) => unit.coverageRadiusKm && (
          <Circle
            key={`coverage-${unit.id}`}
            center={[unit.latitude!, unit.longitude!]}
            radius={unit.coverageRadiusKm * 1000} // km para metros
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#f59e0b',
              fillOpacity: 0.08,
              weight: 1,
              dashArray: '5, 5'
            }}
          />
        ))}
        
        {/* Triângulos das caixas logísticas */}
        {validUnits.map((unit) => (
          <Polygon
            key={`unit-${unit.id}`}
            positions={getTrianglePoints(unit.latitude!, unit.longitude!, 8)}
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#f59e0b',
              fillOpacity: 0.8,
              weight: 2
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <span className="text-amber-500">▲</span>
                  {unit.name}
                </h3>
                <div className="space-y-1 text-sm text-slate-700">
                  {unit.city && unit.state && (
                    <p>
                      <span className="font-medium">Local:</span> {unit.city}, {unit.state}
                    </p>
                  )}
                  {unit.coverageRadiusKm && (
                    <p>
                      <span className="font-medium">Raio de Cobertura:</span> {unit.coverageRadiusKm} km
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Caixa Logística / Armazém
                  </p>
                </div>
              </div>
            </Popup>
          </Polygon>
        ))}
        
        {/* Círculos dos talhões */}
        {validFields.map((field) => (
          <CircleMarker
            key={field.id}
            center={[field.latitude, field.longitude]}
            radius={Math.max(8, Math.sqrt(field.areaHa) * 0.5)}
            pathOptions={{
              color: statusColors[field.status],
              fillColor: statusColors[field.status],
              fillOpacity: 0.6,
              weight: 2
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-bold text-slate-900 mb-2">{field.name}</h3>
                <div className="space-y-1 text-sm text-slate-700">
                  <p>
                    <span className="font-medium">Local:</span> {field.city}, {field.state}
                  </p>
                  <p>
                    <span className="font-medium">Área:</span> {field.areaHa.toLocaleString('pt-BR')} ha
                  </p>
                  <p>
                    <span className="font-medium">Volume:</span> {Math.round(field.volumeKg / 1000).toLocaleString('pt-BR')} ton
                  </p>
                  <p>
                    <span className="font-medium">Status:</span>{' '}
                    <span style={{ color: statusColors[field.status] }}>
                      {statusLabels[field.status]}
                    </span>
                  </p>
                  {field.daysToHarvest > 0 && (
                    <p>
                      <span className="font-medium">Colheita em:</span> {field.daysToHarvest} dias
                    </p>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

export function PropertiesMap({ fields, logisticsUnits = [] }: PropertiesMapProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            Mapa de Propriedades
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <MapContent fields={fields} logisticsUnits={logisticsUnits} />
        
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-sm">
          {Object.entries(statusLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: statusColors[key as keyof typeof statusColors] }}
              />
              <span className="text-slate-400">{label}</span>
            </div>
          ))}
          {/* Caixa Logística na legenda */}
          {logisticsUnits && logisticsUnits.length > 0 && (
            <div className="flex items-center gap-2">
              <div 
                className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-amber-500"
              />
              <span className="text-slate-400">Caixa Logística</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
