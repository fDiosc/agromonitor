import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const templates = [
  {
    id: 'CREDIT',
    name: 'Análise de Crédito',
    description: 'Avaliação de risco para garantias agrícolas, CPRs e operações de crédito rural',
    icon: 'Shield',
    color: 'emerald',
    sortOrder: 1,
    isActive: true,
    currentVersion: '1.0.0',
    metricsSchema: JSON.stringify({
      status: { type: 'status', options: ['NORMAL', 'ALERTA', 'CRITICO'] },
      washoutRisk: { type: 'level', label: 'Risco Washout', options: ['BAIXO', 'MEDIO', 'ALTO'] },
      guaranteeHealth: { type: 'score', label: 'Saúde Garantia', max: 100 },
      deliveryProbability: { type: 'percentage', label: 'Prob. Entrega' },
      cprAdherence: { type: 'boolean', label: 'Aderência CPR' }
    })
  },
  {
    id: 'LOGISTICS',
    name: 'Análise Logística',
    description: 'Previsão de colheita e planejamento de transporte para originação',
    icon: 'Truck',
    color: 'blue',
    sortOrder: 2,
    isActive: true,
    currentVersion: '1.0.0',
    metricsSchema: JSON.stringify({
      harvestWindow: { type: 'dateRange', label: 'Janela Colheita' },
      harvestStart: { type: 'date', label: 'Início Colheita' },
      harvestEnd: { type: 'date', label: 'Fim Colheita' },
      dailyVolume: { type: 'number', unit: 'ton/dia', label: 'Volume Diário' },
      peakPeriod: { type: 'dateRange', label: 'Pico Demanda' },
      weatherRisk: { type: 'level', label: 'Risco Climático', options: ['BAIXO', 'MEDIO', 'ALTO'] },
      grainQualityRisk: { type: 'level', label: 'Risco Qualidade', options: ['BAIXO', 'MEDIO', 'ALTO'] },
      trucksNeeded: { type: 'number', label: 'Carretas Necessárias' }
    })
  },
  {
    id: 'RISK_MATRIX',
    name: 'Matriz de Risco',
    description: 'Visão consolidada de todos os riscos do talhão em categorias',
    icon: 'AlertTriangle',
    color: 'amber',
    sortOrder: 3,
    isActive: true,
    currentVersion: '1.0.0',
    metricsSchema: JSON.stringify({
      overallScore: { type: 'score', label: 'Score Geral', max: 100 },
      climaticRisk: { type: 'level', label: 'Risco Climático', options: ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] },
      phenologicalRisk: { type: 'level', label: 'Risco Fenológico', options: ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] },
      operationalRisk: { type: 'level', label: 'Risco Operacional', options: ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] },
      commercialRisk: { type: 'level', label: 'Risco Comercial', options: ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'] },
      trend: { type: 'trend', label: 'Tendência', options: ['IMPROVING', 'STABLE', 'WORSENING'] }
    })
  }
]

async function main() {
  console.log('🌱 Seeding database...')

  for (const template of templates) {
    await prisma.analysisTemplate.upsert({
      where: { id: template.id },
      update: template,
      create: template
    })
    console.log(`✅ Template "${template.name}" created/updated`)
  }

  console.log('🎉 Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
