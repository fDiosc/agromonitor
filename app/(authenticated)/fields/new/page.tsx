'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, ArrowLeft, Loader2, AlertCircle, CheckCircle, Map, FileUp, UserCheck, Wheat } from 'lucide-react'

// Dynamic import do MapDrawer (client-only por causa do Leaflet)
const MapDrawer = dynamic(
  () => import('@/components/maps/map-drawer').then(mod => mod.MapDrawer),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[450px] rounded-[24px] bg-slate-100 animate-pulse flex items-center justify-center">
        <Loader2 size={32} className="text-slate-300 animate-spin" />
      </div>
    )
  }
)

interface ValidationResult {
  geojson: object
  areaHa: number
  type: string
  vertexCount: number
  warnings?: string[]
}

interface Producer {
  id: string
  name: string
  cpf: string | null
}

type CropType = 'SOJA' | 'MILHO'

export default function NewFieldPage() {
  const router = useRouter()
  
  // Form state
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => {
    // Default para 01/09 do ano atual (início típico de safra)
    const now = new Date()
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
    return `${year}-09-01`
  })
  
  // Novos campos
  const [cropType, setCropType] = useState<CropType>('SOJA')
  const [producerId, setProducerId] = useState<string>('')
  const [plantingDateInput, setPlantingDateInput] = useState<string>('')
  
  // Produtores disponíveis
  const [producers, setProducers] = useState<Producer[]>([])
  const [loadingProducers, setLoadingProducers] = useState(true)
  
  // Carregar produtores ao montar
  useEffect(() => {
    async function fetchProducers() {
      try {
        const res = await fetch('/api/producers')
        if (res.ok) {
          const data = await res.json()
          setProducers(data.producers || [])
        }
      } catch (err) {
        console.error('Erro ao carregar produtores:', err)
      } finally {
        setLoadingProducers(false)
      }
    }
    fetchProducers()
  }, [])
  
  // Upload state
  const [file, setFile] = useState<File | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  
  // Draw state
  const [drawnGeometry, setDrawnGeometry] = useState<string | null>(null)
  const [drawnArea, setDrawnArea] = useState<number>(0)
  
  // General state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('draw') // Default para desenhar

  // Geometria final (pode vir de upload ou desenho)
  const geometryJson = useMemo(() => {
    if (activeTab === 'upload') {
      return validationResult ? JSON.stringify(validationResult.geojson) : null
    }
    return drawnGeometry
  }, [activeTab, validationResult, drawnGeometry])

  // Área final
  const finalArea = useMemo(() => {
    if (activeTab === 'upload') {
      return validationResult?.areaHa || 0
    }
    return drawnArea
  }, [activeTab, validationResult, drawnArea])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setValidationResult(null)
    setIsValidating(true)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.errors?.join(', ') || data.error || 'Erro ao validar arquivo')
        setValidationResult(null)
      } else {
        setValidationResult(data)
        
        // Auto-fill name if empty
        if (!name && selectedFile.name) {
          const baseName = selectedFile.name.replace(/\.(kml|geojson|json)$/i, '')
          setName(baseName)
        }
      }
    } catch {
      setError('Erro ao processar arquivo')
    } finally {
      setIsValidating(false)
    }
  }

  // Callback estável para geometria do mapa
  const handleGeometryChange = useCallback((
    geojson: string | null, 
    areaHa: number
  ) => {
    setDrawnGeometry(geojson)
    setDrawnArea(areaHa)
  }, [])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setError(null)
  }

  const handleSubmit = async (e?: React.MouseEvent) => {
    // Prevenir comportamento padrão
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    // Validações
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Informe o nome do talhão')
      return
    }

    // Verificar geometria baseado na aba ativa
    const currentGeometry = geometryJson

    if (!currentGeometry) {
      setError(activeTab === 'upload' 
        ? 'Selecione um arquivo de geometria' 
        : 'Desenhe o talhão no mapa antes de salvar')
      return
    }

    if (finalArea < 0.5) {
      setError('Área muito pequena (mínimo 0.5 ha)')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        name: trimmedName,
        cropType: cropType,
        seasonStartDate: date,
        geometryJson: currentGeometry,
        producerId: producerId || null,
        plantingDateInput: plantingDateInput || null,
      }

      // Create field
      const res = await fetch('/api/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('API error:', data)
        setError(data.error || 'Erro ao criar talhão')
        return
      }

      // Start processing in background
      fetch(`/api/fields/${data.field.id}/process`, {
        method: 'POST'
      }).catch(console.error)

      // Redirect to dashboard
      router.push('/')
    } catch (err) {
      console.error('Submit error:', err)
      setError('Erro ao criar talhão. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Pode submeter?
  const canSubmit = !!geometryJson && !!name.trim() && !isSubmitting && finalArea >= 0.5

  return (
    <div className="p-8">
      <Link
        href="/"
        className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-all mb-8"
      >
        <ArrowLeft size={16} /> Voltar para Dashboard
      </Link>

      <Card className="p-10 rounded-[48px] max-w-4xl mx-auto">
        <h2 className="text-2xl font-black mb-8 text-center text-slate-900 uppercase tracking-widest border-b pb-4">
          Cadastro de Talhão
        </h2>

        {/* Form fields */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
              Nome do Talhão *
            </label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Fazenda Boa Vista - Talhão 01"
              className="text-base"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
              <UserCheck size={12} />
              Produtor Vinculado
              <span className="text-slate-300 normal-case font-normal">(opcional)</span>
            </label>
            <select
              value={producerId}
              onChange={e => setProducerId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={loadingProducers}
            >
              <option value="">Sem produtor vinculado</option>
              {producers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.cpf ? `(${p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')})` : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
              <Wheat size={12} />
              Cultura
            </label>
            <select
              value={cropType}
              onChange={e => setCropType(e.target.value as CropType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="SOJA">Soja</option>
              <option value="MILHO">Milho</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
              Início da Safra
            </label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
              Data de Plantio Informada pelo Produtor
              <span className="text-slate-300 normal-case font-normal ml-1">(opcional - se informada, será usada como base para cálculos)</span>
            </label>
            <Input
              type="date"
              value={plantingDateInput}
              onChange={e => setPlantingDateInput(e.target.value)}
              className="max-w-xs"
            />
            {plantingDateInput && (
              <p className="text-xs text-emerald-600 mt-1">
                ✓ Data informada pelo produtor será usada como referência confiável para cálculos
              </p>
            )}
          </div>
        </div>

        {/* Tabs: Draw or Upload */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-8">
          <TabsList className="w-full">
            <TabsTrigger value="draw" className="flex-1 gap-2">
              <Map size={16} />
              Desenhar no Mapa
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 gap-2">
              <FileUp size={16} />
              Importar Arquivo
            </TabsTrigger>
          </TabsList>

          {/* Draw Tab */}
          <TabsContent value="draw" className="mt-6">
            <MapDrawer onGeometryChange={handleGeometryChange} />
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="mt-6">
            <div className="relative group">
              <input
                type="file"
                accept=".kml,.geojson,.json"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                disabled={isValidating}
              />
              <div className="w-full p-16 border-4 border-dashed rounded-[32px] border-slate-100 bg-slate-50 flex flex-col items-center group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all">
                {isValidating ? (
                  <Loader2 size={48} className="text-slate-300 animate-spin mb-4" />
                ) : (
                  <Upload size={48} className="text-slate-200 group-hover:text-emerald-400 mb-4 transition-all" />
                )}
                <p className="text-base font-black text-slate-400 tracking-tight">
                  {isValidating
                    ? 'Validando arquivo...'
                    : file
                    ? file.name
                    : 'Clique ou arraste o arquivo do talhão'}
                </p>
                <p className="text-xs text-slate-300 mt-2">
                  Formatos aceitos: KML, GeoJSON
                </p>
              </div>
            </div>

            {/* Validation result */}
            {validationResult && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-2">
                  <CheckCircle size={16} />
                  Geometria válida
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Tipo:</span>{' '}
                    <span className="font-bold text-slate-700">{validationResult.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Vértices:</span>{' '}
                    <span className="font-bold text-slate-700">{validationResult.vertexCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Área:</span>{' '}
                    <span className="font-bold text-slate-700">{validationResult.areaHa?.toFixed(1)} ha</span>
                  </div>
                </div>
                {validationResult.warnings && validationResult.warnings.length > 0 && (
                  <div className="mt-2 text-xs text-amber-600">
                    ⚠️ {validationResult.warnings.join(', ')}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Summary */}
        {geometryJson && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Talhão pronto para processar</p>
                <p className="text-lg font-black text-slate-700">
                  {name || 'Sem nome'} • {finalArea.toFixed(1)} ha
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Cultura: <span className="font-semibold">{cropType === 'SOJA' ? 'Soja' : 'Milho'}</span>
                  {producerId && producers.find(p => p.id === producerId) && (
                    <> • Produtor: <span className="font-semibold">{producers.find(p => p.id === producerId)?.name}</span></>
                  )}
                  {plantingDateInput && (
                    <> • Plantio: <span className="font-semibold">{new Date(plantingDateInput + 'T12:00:00').toLocaleDateString('pt-BR')}</span></>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Safra</p>
                <p className="text-sm font-bold text-slate-600">
                  {new Date(date).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Link href="/" className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              Cancelar
            </Button>
          </Link>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-[2]"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Criando...
              </>
            ) : (
              'Criar e Processar'
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
