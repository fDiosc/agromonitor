'use client'

type CropType = 'SOJA' | 'MILHO'

interface Producer {
  id: string
  name: string
}

interface FieldSummaryCardProps {
  name: string
  finalArea: number
  cropType: CropType
  producerId: string
  producers: Producer[]
  plantingDateInput: string | null
  date: string
}

export function FieldSummaryCard({
  name,
  finalArea,
  cropType,
  producerId,
  producers,
  plantingDateInput,
  date,
}: FieldSummaryCardProps) {
  const producer = producers.find(p => p.id === producerId)

  return (
    <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium">Talhão pronto para processar</p>
          <p className="text-lg font-black text-slate-700">
            {name || 'Sem nome'} • {finalArea.toFixed(1)} ha
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Cultura: <span className="font-semibold">{cropType === 'SOJA' ? 'Soja' : 'Milho'}</span>
            {producerId && producer && (
              <> • Produtor: <span className="font-semibold">{producer.name}</span></>
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
  )
}
