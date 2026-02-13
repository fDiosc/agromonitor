'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Route, Info, RefreshCw, Check, Radar, Loader2 } from 'lucide-react'

interface GeneralSettingsTabProps {
  distanceMethod: 'straight_line' | 'road_distance'
  setDistanceMethod: (v: 'straight_line' | 'road_distance') => void
  googleMapsApiKey: string
  setGoogleMapsApiKey: (v: string) => void
  copernicusClientId: string
  setCopernicusClientId: (v: string) => void
  copernicusClientSecret: string
  setCopernicusClientSecret: (v: string) => void
  reprocessing: boolean
  reprocessResult: { fieldsProcessed: number; distancesCalculated: number } | null
  onReprocess: () => void
}

export function GeneralSettingsTab({
  distanceMethod,
  setDistanceMethod,
  googleMapsApiKey,
  setGoogleMapsApiKey,
  copernicusClientId,
  setCopernicusClientId,
  copernicusClientSecret,
  setCopernicusClientSecret,
  reprocessing,
  reprocessResult,
  onReprocess,
}: GeneralSettingsTabProps) {
  return (
    <>
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
            Define como a distância entre talhões e caixas logísticas é calculada.
          </p>

          <div className="space-y-3">
            <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              distanceMethod === 'straight_line' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
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
                  Calcula a distância em linha reta. Mais rápido e não requer API externa.
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              distanceMethod === 'road_distance' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
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
                  Calcula a distância real pelas estradas. Requer chave de API do Google Maps.
                </p>
              </div>
            </label>
          </div>

          {distanceMethod === 'road_distance' && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Chave de API do Google Maps</p>
                  <input
                    type="password"
                    value={googleMapsApiKey}
                    onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                    placeholder="Cole sua chave de API aqui"
                    className="mt-2 w-full px-3 py-2 border border-amber-300 rounded-md text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credenciais Copernicus */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Radar className="w-5 h-5 text-purple-500" />
            Integração Sentinel-1 (Radar)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Configure as credenciais do Copernicus Data Space para habilitar dados de radar Sentinel-1.
            O radar permite preencher gaps de NDVI causados por nuvens.
          </p>

          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-purple-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-800 mb-2">
                    Como obter credenciais:
                  </p>
                  <ol className="text-xs text-purple-700 list-decimal ml-4 space-y-1">
                    <li>Acesse <a href="https://dataspace.copernicus.eu" target="_blank" rel="noopener" className="underline">dataspace.copernicus.eu</a></li>
                    <li>Crie uma conta gratuita</li>
                    <li>Vá em User Settings → OAuth clients</li>
                    <li>Clique em &quot;Create&quot; e copie o Client ID e Secret</li>
                  </ol>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={copernicusClientId}
                onChange={(e) => setCopernicusClientId(e.target.value)}
                placeholder="ex: sh-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client Secret
              </label>
              <input
                type="password"
                value={copernicusClientSecret}
                onChange={(e) => setCopernicusClientSecret(e.target.value)}
                placeholder={copernicusClientSecret === '********' ? 'Já configurado (deixe em branco para manter)' : 'Cole o secret aqui'}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
              {copernicusClientSecret === '********' && (
                <p className="text-xs text-slate-500 mt-1">
                  Secret já configurado. Deixe em branco para manter ou insira um novo para substituir.
                </p>
              )}
            </div>

            {copernicusClientId && copernicusClientSecret && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm">
                <Check className="w-4 h-4" />
                <span>Credenciais configuradas. Habilite &quot;Sentinel-1 Radar&quot; nos módulos para usar.</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reprocessar Distâncias */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-green-500" />
            Reprocessar Distâncias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Recalcula as distâncias entre todos os talhões e caixas logísticas.
          </p>
          <Button onClick={onReprocess} disabled={reprocessing} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
            {reprocessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reprocessando...</> : <><RefreshCw className="w-4 h-4 mr-2" />Reprocessar</>}
          </Button>
          {reprocessResult && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <Check className="w-4 h-4 inline mr-2" />
              {reprocessResult.fieldsProcessed} talhões, {reprocessResult.distancesCalculated} distâncias.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
