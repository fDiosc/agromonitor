'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface PropertiesMapProps {
  fields: Field[]
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

const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
)

function MapContent({ fields }: { fields: Field[] }) {
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
  
  if (validFields.length === 0) {
    return (
      <div className="h-[400px] bg-slate-900/50 rounded-lg flex items-center justify-center">
        <p className="text-slate-400">Nenhum talhão com coordenadas válidas</p>
      </div>
    )
  }

  // Calculate center
  const centerLat = validFields.reduce((sum, f) => sum + f.latitude, 0) / validFields.length
  const centerLng = validFields.reduce((sum, f) => sum + f.longitude, 0) / validFields.length

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

export function PropertiesMap({ fields }: PropertiesMapProps) {
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
        <MapContent fields={fields} />
        
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
        </div>
      </CardContent>
    </Card>
  )
}
