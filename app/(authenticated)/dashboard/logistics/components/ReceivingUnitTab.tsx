'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Warehouse, Construction, Clock } from 'lucide-react'

export function ReceivingUnitTab() {
  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-16 text-center">
          <div className="relative inline-block">
            <Warehouse className="w-16 h-16 text-slate-500 mx-auto" />
            <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1">
              <Construction className="w-4 h-4 text-yellow-900" />
            </div>
          </div>
          
          <h3 className="text-xl font-semibold text-white mt-6 mb-2">
            Unidade de Recebimento
          </h3>
          
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Este módulo permitirá cadastrar e gerenciar unidades de recebimento (armazéns, silos, etc.) 
            e vincular os talhões a essas unidades para análise logística detalhada.
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
            <Clock className="w-4 h-4" />
            Em desenvolvimento
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700 text-left max-w-lg mx-auto">
            <h4 className="text-sm font-medium text-slate-300 mb-3">
              Funcionalidades planejadas:
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                Cadastro de unidades de recebimento com localização e capacidade
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                Vinculação de talhões a unidades específicas
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                Análise de capacidade vs. volume projetado
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                Rotas e distâncias dos talhões até a unidade
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">•</span>
                Alertas de sobrecarga e gargalos logísticos
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
