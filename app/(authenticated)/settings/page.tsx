'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Settings, 
  Loader2, 
  Save,
  MapPin,
  Route,
  Check,
  Info,
  RefreshCw
} from 'lucide-react'

interface WorkspaceSettings {
  distanceCalculationMethod: 'straight_line' | 'road_distance'
  googleMapsApiKey?: string
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessResult, setReprocessResult] = useState<{ fieldsProcessed: number; distancesCalculated: number } | null>(null)
  
  const [distanceMethod, setDistanceMethod] = useState<'straight_line' | 'road_distance'>('straight_line')
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('')

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/workspace/settings')
        if (res.ok) {
          const data = await res.json()
          const settings = data.settings as WorkspaceSettings | null
          if (settings) {
            setDistanceMethod(settings.distanceCalculationMethod || 'straight_line')
            setGoogleMapsApiKey(settings.googleMapsApiKey || '')
          }
        }
      } catch (err) {
        console.error('Error fetching settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const settings: WorkspaceSettings = {
        distanceCalculationMethod: distanceMethod,
        ...(googleMapsApiKey && { googleMapsApiKey })
      }

      const res = await fetch('/api/workspace/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar')
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const handleReprocess = async () => {
    setReprocessing(true)
    setError(null)
    setReprocessResult(null)

    try {
      const res = await fetch('/api/logistics-units/reprocess', {
        method: 'POST'
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao reprocessar')
        return
      }

      const data = await res.json()
      setReprocessResult({
        fieldsProcessed: data.fieldsProcessed,
        distancesCalculated: data.distancesCalculated
      })
    } catch (err) {
      setError('Erro ao reprocessar distâncias')
    } finally {
      setReprocessing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <Settings className="w-8 h-8 text-slate-600" />
          Configurações
        </h1>
        <p className="text-slate-500 mt-1">
          Configurações do workspace
        </p>
      </div>

      {/* Cálculo de Distância */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Route className="w-5 h-5 text-blue-500" />
            Cálculo de Distância para Caixas Logísticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Define como a distância entre talhões e caixas logísticas é calculada para 
            determinar cobertura e atribuição automática.
          </p>

          <div className="space-y-3">
            <label
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                distanceMethod === 'straight_line'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="distanceMethod"
                value="straight_line"
                checked={distanceMethod === 'straight_line'}
                onChange={() => setDistanceMethod('straight_line')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  <MapPin className="w-4 h-4 text-green-600" />
                  Linha Reta (Haversine)
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Calcula a distância em linha reta entre os pontos. Mais rápido e não requer API externa.
                  Recomendado para a maioria dos casos.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                distanceMethod === 'road_distance'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="distanceMethod"
                value="road_distance"
                checked={distanceMethod === 'road_distance'}
                onChange={() => setDistanceMethod('road_distance')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  <Route className="w-4 h-4 text-orange-600" />
                  Distância Rodoviária (Google Maps)
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Calcula a distância real pelas estradas. Mais preciso para logística, mas requer 
                  chave de API do Google Maps e pode gerar custos.
                </p>
              </div>
            </label>
          </div>

          {/* Google Maps API Key */}
          {distanceMethod === 'road_distance' && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">
                    Chave de API do Google Maps necessária
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Para usar distância rodoviária, você precisa configurar uma chave de API do 
                    Google Maps com a Distance Matrix API habilitada.
                  </p>
                  <input
                    type="password"
                    value={googleMapsApiKey}
                    onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                    placeholder="Cole sua chave de API aqui"
                    className="mt-3 w-full px-3 py-2 border border-amber-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reprocessamento de Distâncias */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-green-500" />
            Reprocessar Distâncias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Recalcula as distâncias entre todos os talhões e caixas logísticas do workspace.
            Use esta opção após mudar o método de cálculo acima ou se precisar atualizar os dados.
          </p>

          <Button
            onClick={handleReprocess}
            disabled={reprocessing}
            variant="outline"
            className="border-green-500 text-green-600 hover:bg-green-50"
          >
            {reprocessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Reprocessando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reprocessar Todas as Distâncias
              </>
            )}
          </Button>

          {reprocessResult && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <Check className="w-4 h-4 inline mr-2" />
              Reprocessamento concluído: {reprocessResult.fieldsProcessed} talhões, {reprocessResult.distancesCalculated} distâncias calculadas.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Salvo!
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
        {saved && (
          <span className="text-sm text-green-600">
            Configurações salvas com sucesso!
          </span>
        )}
      </div>
    </div>
  )
}
