'use client'

import { MapPin, AlertTriangle, Check, Circle } from 'lucide-react'

interface LogisticsUnit {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  coverageRadiusKm: number | null
}

interface FieldCoverage {
  fieldId: string
  fieldName: string
  latitude: number | null
  longitude: number | null
  producerName: string | null
  assignedUnitId: string | null
  assignedUnitName: string | null
  assignmentType: 'direct' | 'inherited' | 'automatic' | 'none'
  coveringUnits: { id: string; name: string; distance: number }[]
  hasIntersection: boolean
}

interface Props {
  units: LogisticsUnit[]
  fields: FieldCoverage[]
  selectedUnitId: string | null
  onUnitClick: (unitId: string) => void
}

// Versão simplificada sem mapa - exibe tabela de cobertura
export function CoverageMap({ units, fields, selectedUnitId, onUnitClick }: Props) {
  // Filtrar campos baseado na seleção
  // IMPORTANTE: Se o campo tem assign manual (direct), só mostra para a caixa atribuída
  const displayFields = selectedUnitId
    ? fields.filter(f => {
        // Se tem atribuição direta, só mostra se a caixa selecionada é a atribuída
        if (f.assignmentType === 'direct' && f.assignedUnitId) {
          return f.assignedUnitId === selectedUnitId
        }
        // Se tem atribuição herdada do produtor, só mostra se a caixa selecionada é a herdada
        if (f.assignmentType === 'inherited' && f.assignedUnitId) {
          return f.assignedUnitId === selectedUnitId
        }
        // Caso contrário, mostra se está coberto por raio
        return f.coveringUnits.some(u => u.id === selectedUnitId)
      })
    : fields

  // Agrupar por status de cobertura
  const covered = displayFields.filter(f => 
    f.assignmentType === 'direct' || 
    f.assignmentType === 'inherited' || 
    (f.coveringUnits.length >= 1 && !f.hasIntersection)
  )
  const intersections = displayFields.filter(f => 
    f.hasIntersection && f.assignmentType !== 'direct' && f.assignmentType !== 'inherited'
  )
  const uncovered = displayFields.filter(f => f.coveringUnits.length === 0 && f.assignmentType === 'none')

  return (
    <div className="h-[500px] rounded-lg bg-slate-800/50 border border-slate-700 overflow-hidden">
      {/* Header com resumo */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            Visualização de cobertura {selectedUnitId && '(filtrado)'}
          </span>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-emerald-400">
              <Circle className="w-2 h-2 fill-current" /> {covered.length} cobertos
            </span>
            <span className="flex items-center gap-1 text-yellow-400">
              <Circle className="w-2 h-2 fill-current" /> {intersections.length} interseção
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <Circle className="w-2 h-2 fill-current" /> {uncovered.length} sem cobertura
            </span>
          </div>
        </div>
      </div>

      {/* Lista de caixas logísticas */}
      <div className="p-4 border-b border-slate-700">
        <div className="text-xs text-slate-400 mb-2">Caixas Logísticas:</div>
        <div className="flex flex-wrap gap-2">
          {units.map(unit => (
            <button
              key={unit.id}
              onClick={() => onUnitClick(unit.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedUnitId === unit.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                {unit.name}
                {unit.coverageRadiusKm && (
                  <span className="text-xs opacity-70">({unit.coverageRadiusKm}km)</span>
                )}
              </span>
            </button>
          ))}
          {selectedUnitId && (
            <button
              onClick={() => onUnitClick(selectedUnitId)}
              className="px-3 py-1.5 rounded-full text-sm bg-slate-600 text-slate-300 hover:bg-slate-500"
            >
              Limpar filtro
            </button>
          )}
        </div>
      </div>

      {/* Tabela de talhões */}
      <div className="overflow-auto pb-2" style={{ maxHeight: 'calc(500px - 160px)' }}>
        <table className="w-full text-sm table-fixed">
          <thead className="bg-slate-800/80 sticky top-0 z-10">
            <tr className="text-left text-slate-400 text-xs">
              <th className="px-3 py-2 w-12">Status</th>
              <th className="px-3 py-2 w-28">Talhão</th>
              <th className="px-3 py-2 w-24">Produtor</th>
              <th className="px-3 py-2">Cobertura</th>
              <th className="px-3 py-2 w-20 text-right">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {displayFields.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  {selectedUnitId ? 'Nenhum talhão coberto por esta caixa' : 'Nenhum talhão cadastrado'}
                </td>
              </tr>
            ) : (
              displayFields.map(field => {
                // Determinar badge e cor
                let badge: string
                let badgeClass: string
                let badgeTitle: string

                if (field.assignmentType === 'direct') {
                  badge = 'M'
                  badgeClass = 'bg-blue-500'
                  badgeTitle = 'Manual'
                } else if (field.assignmentType === 'inherited') {
                  badge = 'P'
                  badgeClass = 'bg-purple-500'
                  badgeTitle = 'Produtor'
                } else if (field.coveringUnits.length === 0) {
                  badge = '!'
                  badgeClass = 'bg-red-500'
                  badgeTitle = 'Sem cobertura'
                } else if (field.hasIntersection) {
                  badge = 'A'
                  badgeClass = 'bg-yellow-500'
                  badgeTitle = 'Automático (interseção)'
                } else {
                  badge = 'A'
                  badgeClass = 'bg-green-500'
                  badgeTitle = 'Automático'
                }

                // Função para truncar nome da caixa
                const truncateName = (name: string, max: number = 25) => 
                  name.length > max ? name.substring(0, max) + '...' : name

                return (
                  <tr key={field.fieldId} className="hover:bg-slate-700/30 border-b border-slate-700/30 last:border-b-0">
                    <td className="px-3 py-2">
                      <span 
                        className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white rounded ${badgeClass}`}
                        title={badgeTitle}
                      >
                        {badge}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-white truncate" title={field.fieldName}>
                      {field.fieldName}
                    </td>
                    <td className="px-3 py-2 text-slate-400 truncate text-xs" title={field.producerName || ''}>
                      {field.producerName || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {field.assignmentType === 'direct' && field.assignedUnitName ? (
                        <span className="text-blue-400" title={field.assignedUnitName}>
                          {truncateName(field.assignedUnitName)}
                        </span>
                      ) : field.assignmentType === 'inherited' && field.assignedUnitName ? (
                        <span className="text-purple-400" title={field.assignedUnitName}>
                          {truncateName(field.assignedUnitName)}
                        </span>
                      ) : field.coveringUnits.length === 0 ? (
                        <span className="text-red-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {field.coveringUnits.slice(0, 2).map((u) => (
                            <span 
                              key={u.id}
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                                u.id === selectedUnitId 
                                  ? 'bg-blue-500/30 text-blue-300' 
                                  : 'bg-slate-600/50 text-slate-300'
                              }`}
                              title={`${u.name} (${u.distance.toFixed(1)}km)`}
                            >
                              {truncateName(u.name, 15)} <span className="opacity-60">{u.distance.toFixed(0)}km</span>
                            </span>
                          ))}
                          {field.coveringUnits.length > 2 && (
                            <span 
                              className="text-[10px] text-slate-500"
                              title={field.coveringUnits.slice(2).map(u => u.name).join(', ')}
                            >
                              +{field.coveringUnits.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                        field.assignmentType === 'direct' ? 'bg-blue-500/20 text-blue-300' :
                        field.assignmentType === 'inherited' ? 'bg-purple-500/20 text-purple-300' :
                        field.assignmentType === 'automatic' ? 'bg-green-500/20 text-green-300' :
                        'bg-slate-600/50 text-slate-400'
                      }`}>
                        {field.assignmentType === 'direct' && 'Manual'}
                        {field.assignmentType === 'inherited' && 'Produtor'}
                        {field.assignmentType === 'automatic' && 'Auto'}
                        {field.assignmentType === 'none' && '—'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
