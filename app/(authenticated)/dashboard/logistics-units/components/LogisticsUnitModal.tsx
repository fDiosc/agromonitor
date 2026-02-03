'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Loader2, MapPin } from 'lucide-react'

interface LogisticsUnit {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  address: string | null
  city: string | null
  state: string | null
  coverageRadiusKm: number | null
  dailyCapacityTons?: number | null
  storageCapacityTons?: number | null
  isActive: boolean
}

interface Props {
  open: boolean
  unit: LogisticsUnit | null
  onClose: (saved: boolean) => void
}

export function LogisticsUnitModal({ open, unit, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [name, setName] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [coverageRadiusKm, setCoverageRadiusKm] = useState('')
  const [dailyCapacityTons, setDailyCapacityTons] = useState('')
  const [storageCapacityTons, setStorageCapacityTons] = useState('')

  useEffect(() => {
    if (unit) {
      setName(unit.name || '')
      setLatitude(unit.latitude?.toString() || '')
      setLongitude(unit.longitude?.toString() || '')
      setAddress(unit.address || '')
      setCity(unit.city || '')
      setState(unit.state || '')
      setCoverageRadiusKm(unit.coverageRadiusKm?.toString() || '')
      setDailyCapacityTons(unit.dailyCapacityTons?.toString() || '')
      setStorageCapacityTons(unit.storageCapacityTons?.toString() || '')
    } else {
      // Reset form
      setName('')
      setLatitude('')
      setLongitude('')
      setAddress('')
      setCity('')
      setState('')
      setCoverageRadiusKm('')
      setDailyCapacityTons('')
      setStorageCapacityTons('')
    }
    setError(null)
  }, [unit, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const payload = {
        name,
        latitude: latitude || null,
        longitude: longitude || null,
        address: address || null,
        city: city || null,
        state: state || null,
        coverageRadiusKm: coverageRadiusKm || null,
        dailyCapacityTons: dailyCapacityTons || null,
        storageCapacityTons: storageCapacityTons || null
      }

      const url = unit 
        ? `/api/logistics-units/${unit.id}` 
        : '/api/logistics-units'
      
      const method = unit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao salvar')
        return
      }

      onClose(true)
    } catch (err) {
      setError('Erro ao salvar caixa logística')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <Card className="w-full max-w-lg mx-4 bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-white">
            {unit ? 'Editar Caixa Logística' : 'Nova Caixa Logística'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
            onClick={() => onClose(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Armazém Central"
                required
              />
            </div>

            {/* Coordenadas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="-15.1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="-55.5678"
                />
              </div>
            </div>

            {/* Endereço */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Endereço
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Rua, número, bairro"
              />
            </div>

            {/* Cidade/Estado */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Sorriso"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Estado
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="MT"
                />
              </div>
            </div>

            {/* Raio de Cobertura */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Raio de Atuação (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={coverageRadiusKm}
                onChange={(e) => setCoverageRadiusKm(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Deixe vazio para sem limite"
              />
              <p className="text-xs text-slate-500 mt-1">
                Define o raio de atuação da caixa logística. Talhões fora deste raio não serão atribuídos automaticamente.
              </p>
            </div>

            {/* Capacidades (opcional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Capacidade Diária (ton)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={dailyCapacityTons}
                  onChange={(e) => setDailyCapacityTons(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Capacidade Armazenagem (ton)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={storageCapacityTons}
                  onChange={(e) => setStorageCapacityTons(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onClose(false)}
                disabled={loading}
                className="border-slate-600"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
