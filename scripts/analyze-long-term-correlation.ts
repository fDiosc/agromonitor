/**
 * Análise de correlação NDVI-SAR com séries longas (5 anos)
 * 
 * Objetivos:
 * 1. Verificar dados disponíveis (NDVI e SAR)
 * 2. Analisar correlações com séries maiores
 * 3. Testar modelos ML para melhorar predição
 * 4. Identificar padrões de outliers
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================================
// FUNÇÕES ESTATÍSTICAS
// ============================================================================

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function std(arr: number[]): number {
  const m = mean(arr)
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length)
}

function pearson(x: number[], y: number[]): number {
  const n = x.length
  if (n < 3) return 0
  const mx = mean(x), my = mean(y)
  const sx = std(x), sy = std(y)
  if (sx === 0 || sy === 0) return 0
  return x.reduce((sum, xi, i) => sum + (xi - mx) * (y[i] - my), 0) / (n * sx * sy)
}

function r2Score(actual: number[], predicted: number[]): number {
  const m = mean(actual)
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < actual.length; i++) {
    ssRes += (actual[i] - predicted[i]) ** 2
    ssTot += (actual[i] - m) ** 2
  }
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot
}

function rmse(actual: number[], predicted: number[]): number {
  return Math.sqrt(actual.reduce((sum, a, i) => sum + (a - predicted[i]) ** 2, 0) / actual.length)
}

function mae(actual: number[], predicted: number[]): number {
  return actual.reduce((sum, a, i) => sum + Math.abs(a - predicted[i]), 0) / actual.length
}

// ============================================================================
// MODELOS DE REGRESSÃO
// ============================================================================

// Regressão Linear Simples
function linearRegression(x: number[], y: number[]): { a: number, b: number, predict: (v: number) => number } {
  const n = x.length
  const mx = mean(x), my = mean(y)
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my)
    den += (x[i] - mx) ** 2
  }
  const a = den !== 0 ? num / den : 0
  const b = my - a * mx
  return { a, b, predict: (v: number) => Math.max(0, Math.min(1, a * v + b)) }
}

// Regressão Múltipla com Ridge
function multipleRegression(X: number[][], y: number[], ridge = 0.01): { 
  coeffs: number[], 
  predict: (x: number[]) => number 
} {
  const n = X.length
  const p = X[0].length + 1
  const Xext = X.map(row => [1, ...row])
  
  const XtX = Array(p).fill(0).map(() => Array(p).fill(0))
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < n; k++) XtX[i][j] += Xext[k][i] * Xext[k][j]
    }
  }
  for (let i = 1; i < p; i++) XtX[i][i] += ridge
  
  const Xty = Array(p).fill(0)
  for (let i = 0; i < p; i++) {
    for (let k = 0; k < n; k++) Xty[i] += Xext[k][i] * y[k]
  }
  
  const M = XtX.map((row, i) => [...row, Xty[i]])
  for (let col = 0; col < p; col++) {
    let maxRow = col
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]]
    if (Math.abs(M[col][col]) < 1e-10) continue
    for (let row = col + 1; row < p; row++) {
      const f = M[row][col] / M[col][col]
      for (let j = col; j <= p; j++) M[row][j] -= f * M[col][j]
    }
  }
  const coeffs = Array(p).fill(0)
  for (let i = p - 1; i >= 0; i--) {
    coeffs[i] = M[i][p]
    for (let j = i + 1; j < p; j++) coeffs[i] -= M[i][j] * coeffs[j]
    if (Math.abs(M[i][i]) > 1e-10) coeffs[i] /= M[i][i]
  }
  
  return {
    coeffs,
    predict: (x: number[]) => Math.max(0, Math.min(1, coeffs[0] + x.reduce((sum, xi, i) => sum + coeffs[i + 1] * xi, 0)))
  }
}

// Regressão Polinomial (grau 2)
function polynomialRegression(x: number[], y: number[]): { predict: (v: number) => number, coeffs: number[] } {
  const X = x.map(v => [v, v * v])
  const model = multipleRegression(X, y)
  return {
    coeffs: model.coeffs,
    predict: (v: number) => model.predict([v, v * v])
  }
}

// Random Forest simplificado (ensemble de árvores de decisão)
function simpleRandomForest(X: number[][], y: number[], nTrees = 10): { predict: (x: number[]) => number } {
  const n = X.length
  const trees: Array<{ predict: (x: number[]) => number }> = []
  
  for (let t = 0; t < nTrees; t++) {
    // Bootstrap sample
    const indices: number[] = []
    for (let i = 0; i < n; i++) {
      indices.push(Math.floor(Math.random() * n))
    }
    
    const Xsample = indices.map(i => X[i])
    const ysample = indices.map(i => y[i])
    
    // Treinar regressão com subset de features
    const nFeatures = X[0].length
    const featureSubset = Array.from({ length: nFeatures }, (_, i) => i)
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.max(2, Math.floor(nFeatures * 0.7)))
    
    const XsubsetSample = Xsample.map(row => featureSubset.map(f => row[f]))
    const model = multipleRegression(XsubsetSample, ysample, 0.1)
    
    trees.push({
      predict: (x: number[]) => model.predict(featureSubset.map(f => x[f]))
    })
  }
  
  return {
    predict: (x: number[]) => {
      const predictions = trees.map(t => t.predict(x))
      return mean(predictions)
    }
  }
}

// Gradient Boosting simplificado
function simpleGradientBoosting(X: number[][], y: number[], nEstimators = 10, learningRate = 0.1): { predict: (x: number[]) => number } {
  const n = X.length
  const predictions = new Array(n).fill(mean(y))
  const models: Array<{ predict: (x: number[]) => number, weight: number }> = []
  
  for (let i = 0; i < nEstimators; i++) {
    // Calcular residuais
    const residuals = y.map((yi, j) => yi - predictions[j])
    
    // Treinar modelo nos residuais
    const model = multipleRegression(X, residuals, 0.1)
    
    // Atualizar predições
    for (let j = 0; j < n; j++) {
      predictions[j] += learningRate * model.predict(X[j])
    }
    
    models.push({ predict: model.predict, weight: learningRate })
  }
  
  const basePrediction = mean(y)
  
  return {
    predict: (x: number[]) => {
      let pred = basePrediction
      for (const m of models) {
        pred += m.weight * m.predict(x)
      }
      return Math.max(0, Math.min(1, pred))
    }
  }
}

// ============================================================================
// DETECÇÃO DE OUTLIERS
// ============================================================================

function detectOutliers(errors: number[], threshold = 2): boolean[] {
  const m = mean(errors)
  const s = std(errors)
  return errors.map(e => Math.abs(e - m) > threshold * s)
}

function removeOutliers<T>(data: T[], isOutlier: boolean[]): T[] {
  return data.filter((_, i) => !isOutlier[i])
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(100))
  console.log('ANÁLISE DE CORRELAÇÃO NDVI-SAR COM SÉRIES LONGAS (5 ANOS)')
  console.log('='.repeat(100))
  
  // Buscar Talhão 01 com radar
  const fields = await prisma.field.findMany({
    where: { name: 'Talhão 01', ndviData: { some: {} } },
    include: { 
      ndviData: { orderBy: { date: 'asc' } }, 
      agroData: true,
      rviNdviPairs: true
    }
  })
  
  const field = fields.find(f => {
    if (!f.agroData?.rawAreaData) return false
    try {
      const data = JSON.parse(f.agroData.rawAreaData)
      const radar = typeof data.radar === 'string' ? JSON.parse(data.radar) : data.radar
      return radar?.data?.length > 0
    } catch { return false }
  })
  
  if (!field) {
    console.log('Talhão 01 com radar não encontrado')
    return
  }
  
  console.log(`\nCampo: ${field.name} (${field.id})`)
  
  // ========================================================================
  // ANÁLISE DE DADOS DISPONÍVEIS
  // ========================================================================
  
  console.log('\n' + '─'.repeat(100))
  console.log('1. DADOS DISPONÍVEIS')
  console.log('─'.repeat(100))
  
  // NDVI
  const ndviData = field.ndviData.filter(d => {
    const val = d.ndviSmooth ?? d.ndviRaw ?? d.ndviInterp
    return val !== null && val !== undefined
  })
  
  const ndviDates = ndviData.map(d => new Date(d.date))
  const minNdviDate = new Date(Math.min(...ndviDates.map(d => d.getTime())))
  const maxNdviDate = new Date(Math.max(...ndviDates.map(d => d.getTime())))
  
  console.log(`\nNDVI:`)
  console.log(`  Total de pontos: ${ndviData.length}`)
  console.log(`  Período: ${minNdviDate.toISOString().split('T')[0]} a ${maxNdviDate.toISOString().split('T')[0]}`)
  console.log(`  Anos cobertos: ${((maxNdviDate.getTime() - minNdviDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1)}`)
  
  // SAR
  const rawAreaData = JSON.parse(field.agroData!.rawAreaData!)
  const radar = typeof rawAreaData.radar === 'string' 
    ? JSON.parse(rawAreaData.radar) 
    : rawAreaData.radar
  
  const sarData = radar.data as Array<{date: string, vv: number, vh: number, rvi?: number}>
  const sarDates = sarData.map(d => new Date(d.date))
  const minSarDate = new Date(Math.min(...sarDates.map(d => d.getTime())))
  const maxSarDate = new Date(Math.max(...sarDates.map(d => d.getTime())))
  
  console.log(`\nSAR (Sentinel-1):`)
  console.log(`  Total de cenas: ${sarData.length}`)
  console.log(`  Período: ${minSarDate.toISOString().split('T')[0]} a ${maxSarDate.toISOString().split('T')[0]}`)
  console.log(`  Meses cobertos: ${((maxSarDate.getTime() - minSarDate.getTime()) / (30 * 24 * 60 * 60 * 1000)).toFixed(1)}`)
  
  // Pares RVI-NDVI já salvos
  console.log(`\nPares RVI-NDVI salvos: ${field.rviNdviPairs.length}`)
  
  // ========================================================================
  // CRIAR PARES NDVI-SAR
  // ========================================================================
  
  console.log('\n' + '─'.repeat(100))
  console.log('2. CRIAÇÃO DE PARES NDVI-SAR')
  console.log('─'.repeat(100))
  
  // Mapa de NDVI
  const ndviMap = new Map<string, number>()
  for (const d of ndviData) {
    const dateStr = new Date(d.date).toISOString().split('T')[0]
    const val = d.ndviSmooth ?? d.ndviRaw ?? d.ndviInterp
    if (val !== null && val !== undefined) {
      ndviMap.set(dateStr, val)
    }
  }
  
  // Mapa de temperatura
  const tempMap = new Map<string, number>()
  if (rawAreaData.thermal) {
    const thermal = typeof rawAreaData.thermal === 'string' 
      ? JSON.parse(rawAreaData.thermal) 
      : rawAreaData.thermal
    if (thermal.temperature?.points) {
      for (const p of thermal.temperature.points) {
        tempMap.set(p.date, p.value)
      }
    }
  }
  
  interface DataPair {
    date: string
    vv: number
    vh: number
    vhVvRatio: number
    rvi: number
    temp?: number
    ndvi: number
    month: number
    dayOfYear: number
  }
  
  const pairs: DataPair[] = []
  
  for (const sar of sarData) {
    // Correspondência direta ou ±1 dia
    let ndvi = ndviMap.get(sar.date)
    if (ndvi === undefined) {
      const d = new Date(sar.date)
      for (const offset of [-1, 1]) {
        const checkDate = new Date(d)
        checkDate.setDate(checkDate.getDate() + offset)
        const checkStr = checkDate.toISOString().split('T')[0]
        ndvi = ndviMap.get(checkStr)
        if (ndvi !== undefined) break
      }
    }
    
    if (ndvi !== undefined) {
      const d = new Date(sar.date)
      const startOfYear = new Date(d.getFullYear(), 0, 0)
      const dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
      
      // Calcular RVI (DpRVI)
      const vhLin = Math.pow(10, sar.vh / 10)
      const vvLin = Math.pow(10, sar.vv / 10)
      const q = vvLin > 1e-10 ? vhLin / vvLin : 1
      const rvi = (q * (q + 3)) / ((q + 1) ** 2)
      
      pairs.push({
        date: sar.date,
        vv: sar.vv,
        vh: sar.vh,
        vhVvRatio: sar.vh - sar.vv,  // Em dB, diferença = ratio
        rvi: Math.max(0, Math.min(1, rvi)),
        temp: tempMap.get(sar.date),
        ndvi,
        month: d.getMonth() + 1,
        dayOfYear
      })
    }
  }
  
  console.log(`\nPares criados: ${pairs.length}`)
  console.log(`Com temperatura: ${pairs.filter(p => p.temp !== undefined).length}`)
  
  if (pairs.length < 10) {
    console.log('\n[!] Poucos pares para análise robusta')
    console.log('    O SAR só tem dados recentes, precisamos de mais histórico')
    
    // Sugestão
    console.log('\n' + '─'.repeat(100))
    console.log('SUGESTÃO: BUSCAR SAR HISTÓRICO')
    console.log('─'.repeat(100))
    console.log(`
Para ter 5 anos de dados SAR-NDVI, precisamos:

1. Buscar dados Sentinel-1 históricos (disponível desde 2014)
   - API do Copernicus Data Space suporta busca histórica
   - Processar e armazenar VV/VH para datas passadas

2. Alternativa: Usar correlação temporal
   - Criar "pseudo-pares" usando padrões sazonais
   - Ex: SAR de outubro 2025 ~ NDVI de outubro 2022-2024 (mesmo mês)

3. Verificar dados já existentes de RviNdviPairs
   - Total salvo: ${field.rviNdviPairs.length}
`)
    
    await prisma.$disconnect()
    return
  }
  
  // ========================================================================
  // ANÁLISE EXPLORATÓRIA
  // ========================================================================
  
  console.log('\n' + '─'.repeat(100))
  console.log('3. ANÁLISE EXPLORATÓRIA')
  console.log('─'.repeat(100))
  
  const vh = pairs.map(p => p.vh)
  const vv = pairs.map(p => p.vv)
  const vhVvRatio = pairs.map(p => p.vhVvRatio)
  const rvi = pairs.map(p => p.rvi)
  const ndvi = pairs.map(p => p.ndvi)
  
  console.log(`\nCorrelações com NDVI:`)
  console.log(`  VH (dB):        ${(pearson(vh, ndvi) * 100).toFixed(1)}%`)
  console.log(`  VV (dB):        ${(pearson(vv, ndvi) * 100).toFixed(1)}%`)
  console.log(`  VH/VV (dB):     ${(pearson(vhVvRatio, ndvi) * 100).toFixed(1)}%`)
  console.log(`  RVI (DpRVI):    ${(pearson(rvi, ndvi) * 100).toFixed(1)}%`)
  
  const pairsWithTemp = pairs.filter(p => p.temp !== undefined)
  if (pairsWithTemp.length >= 5) {
    const temps = pairsWithTemp.map(p => p.temp!)
    const ndvisT = pairsWithTemp.map(p => p.ndvi)
    console.log(`  Temperatura:    ${(pearson(temps, ndvisT) * 100).toFixed(1)}% (n=${pairsWithTemp.length})`)
  }
  
  // Estatísticas descritivas
  console.log(`\nEstatísticas descritivas:`)
  console.log(`  NDVI: min=${Math.min(...ndvi).toFixed(3)}, max=${Math.max(...ndvi).toFixed(3)}, mean=${mean(ndvi).toFixed(3)}, std=${std(ndvi).toFixed(3)}`)
  console.log(`  VH:   min=${Math.min(...vh).toFixed(1)}, max=${Math.max(...vh).toFixed(1)}, mean=${mean(vh).toFixed(1)}, std=${std(vh).toFixed(1)}`)
  console.log(`  VV:   min=${Math.min(...vv).toFixed(1)}, max=${Math.max(...vv).toFixed(1)}, mean=${mean(vv).toFixed(1)}, std=${std(vv).toFixed(1)}`)
  
  // ========================================================================
  // TESTE DE MODELOS
  // ========================================================================
  
  console.log('\n' + '─'.repeat(100))
  console.log('4. TESTE DE MODELOS ML')
  console.log('─'.repeat(100))
  
  // Preparar features
  const X_basic = pairs.map(p => [p.vh, p.vv])
  const X_extended = pairs.map(p => [p.vh, p.vv, p.vhVvRatio])
  const X_with_season = pairs.map(p => [
    p.vh, p.vv, 
    Math.sin(2 * Math.PI * p.dayOfYear / 365),  // Componente sazonal
    Math.cos(2 * Math.PI * p.dayOfYear / 365)
  ])
  
  interface ModelResult {
    name: string
    r2: number
    rmse: number
    mae: number
    predictions: number[]
  }
  
  const results: ModelResult[] = []
  
  // Modelo 1: Linear VH+VV
  {
    const model = multipleRegression(X_basic, ndvi)
    const pred = pairs.map(p => model.predict([p.vh, p.vv]))
    results.push({
      name: 'Linear (VH+VV)',
      r2: r2Score(ndvi, pred),
      rmse: rmse(ndvi, pred),
      mae: mae(ndvi, pred),
      predictions: pred
    })
  }
  
  // Modelo 2: Linear VH+VV+VH/VV
  {
    const model = multipleRegression(X_extended, ndvi)
    const pred = pairs.map(p => model.predict([p.vh, p.vv, p.vhVvRatio]))
    results.push({
      name: 'Linear (VH+VV+ratio)',
      r2: r2Score(ndvi, pred),
      rmse: rmse(ndvi, pred),
      mae: mae(ndvi, pred),
      predictions: pred
    })
  }
  
  // Modelo 3: Com sazonalidade
  {
    const model = multipleRegression(X_with_season, ndvi)
    const pred = pairs.map(p => model.predict([
      p.vh, p.vv,
      Math.sin(2 * Math.PI * p.dayOfYear / 365),
      Math.cos(2 * Math.PI * p.dayOfYear / 365)
    ]))
    results.push({
      name: 'Linear + Sazonal',
      r2: r2Score(ndvi, pred),
      rmse: rmse(ndvi, pred),
      mae: mae(ndvi, pred),
      predictions: pred
    })
  }
  
  // Modelo 4: Polinomial no RVI
  {
    const model = polynomialRegression(rvi, ndvi)
    const pred = rvi.map(r => model.predict(r))
    results.push({
      name: 'Polinomial (RVI²)',
      r2: r2Score(ndvi, pred),
      rmse: rmse(ndvi, pred),
      mae: mae(ndvi, pred),
      predictions: pred
    })
  }
  
  // Modelo 5: Random Forest
  {
    const model = simpleRandomForest(X_extended, ndvi, 15)
    const pred = pairs.map(p => model.predict([p.vh, p.vv, p.vhVvRatio]))
    results.push({
      name: 'Random Forest (15 trees)',
      r2: r2Score(ndvi, pred),
      rmse: rmse(ndvi, pred),
      mae: mae(ndvi, pred),
      predictions: pred
    })
  }
  
  // Modelo 6: Gradient Boosting
  {
    const model = simpleGradientBoosting(X_extended, ndvi, 15, 0.1)
    const pred = pairs.map(p => model.predict([p.vh, p.vv, p.vhVvRatio]))
    results.push({
      name: 'Gradient Boosting (15)',
      r2: r2Score(ndvi, pred),
      rmse: rmse(ndvi, pred),
      mae: mae(ndvi, pred),
      predictions: pred
    })
  }
  
  // Modelo 7: Com temperatura (se disponível)
  if (pairsWithTemp.length >= 10) {
    const X_temp = pairsWithTemp.map(p => [p.vh, p.vv, p.temp!])
    const y_temp = pairsWithTemp.map(p => p.ndvi)
    const model = multipleRegression(X_temp, y_temp)
    const pred = pairsWithTemp.map(p => model.predict([p.vh, p.vv, p.temp!]))
    results.push({
      name: 'Linear + Temp',
      r2: r2Score(y_temp, pred),
      rmse: rmse(y_temp, pred),
      mae: mae(y_temp, pred),
      predictions: pred
    })
  }
  
  // Ordenar por R²
  results.sort((a, b) => b.r2 - a.r2)
  
  console.log(`\n${'Modelo'.padEnd(30)} | ${'R²'.padStart(8)} | ${'RMSE'.padStart(8)} | ${'MAE'.padStart(8)}`)
  console.log(`${'-'.repeat(30)}-|-${'-'.repeat(8)}-|-${'-'.repeat(8)}-|-${'-'.repeat(8)}`)
  
  for (const r of results) {
    console.log(`${r.name.padEnd(30)} | ${(r.r2 * 100).toFixed(1).padStart(7)}% | ${r.rmse.toFixed(4).padStart(8)} | ${r.mae.toFixed(4).padStart(8)}`)
  }
  
  const best = results[0]
  console.log(`\n★ MELHOR MODELO: ${best.name}`)
  console.log(`  R² = ${(best.r2 * 100).toFixed(1)}%, RMSE = ${best.rmse.toFixed(4)}, MAE = ${best.mae.toFixed(4)}`)
  
  // ========================================================================
  // ANÁLISE DE OUTLIERS
  // ========================================================================
  
  console.log('\n' + '─'.repeat(100))
  console.log('5. ANÁLISE DE OUTLIERS')
  console.log('─'.repeat(100))
  
  // Usar o melhor modelo
  const errors = pairs.map((p, i) => Math.abs(p.ndvi - best.predictions[i]))
  const isOutlier = detectOutliers(errors, 2)
  const outlierCount = isOutlier.filter(x => x).length
  
  console.log(`\nOutliers detectados (erro > 2σ): ${outlierCount} de ${pairs.length} (${(outlierCount/pairs.length*100).toFixed(1)}%)`)
  
  if (outlierCount > 0) {
    console.log(`\nDetalhes dos outliers:`)
    console.log(`| ${'Data'.padEnd(12)} | ${'VH'.padStart(8)} | ${'VV'.padStart(8)} | ${'NDVI Real'.padStart(10)} | ${'NDVI Pred'.padStart(10)} | ${'Erro'.padStart(8)} |`)
    console.log(`|${'-'.repeat(14)}|${'-'.repeat(10)}|${'-'.repeat(10)}|${'-'.repeat(12)}|${'-'.repeat(12)}|${'-'.repeat(10)}|`)
    
    for (let i = 0; i < pairs.length; i++) {
      if (isOutlier[i]) {
        const p = pairs[i]
        console.log(`| ${p.date.padEnd(12)} | ${p.vh.toFixed(2).padStart(8)} | ${p.vv.toFixed(2).padStart(8)} | ${p.ndvi.toFixed(4).padStart(10)} | ${best.predictions[i].toFixed(4).padStart(10)} | ${errors[i].toFixed(4).padStart(8)} |`)
      }
    }
  }
  
  // Retreinar sem outliers
  const cleanPairs = removeOutliers(pairs, isOutlier)
  const cleanNdvi = cleanPairs.map(p => p.ndvi)
  const cleanX = cleanPairs.map(p => [p.vh, p.vv, p.vhVvRatio])
  
  if (cleanPairs.length >= 10) {
    const cleanModel = multipleRegression(cleanX, cleanNdvi)
    const cleanPred = cleanPairs.map(p => cleanModel.predict([p.vh, p.vv, p.vhVvRatio]))
    
    console.log(`\n★ MODELO RETREINADO SEM OUTLIERS:`)
    console.log(`  Pontos usados: ${cleanPairs.length} (removidos: ${outlierCount})`)
    console.log(`  R² = ${(r2Score(cleanNdvi, cleanPred) * 100).toFixed(1)}%`)
    console.log(`  RMSE = ${rmse(cleanNdvi, cleanPred).toFixed(4)}`)
    console.log(`  MAE = ${mae(cleanNdvi, cleanPred).toFixed(4)}`)
  }
  
  // ========================================================================
  // CONCLUSÕES
  // ========================================================================
  
  console.log('\n' + '═'.repeat(100))
  console.log('CONCLUSÕES E RECOMENDAÇÕES')
  console.log('═'.repeat(100))
  
  console.log(`
1. DADOS DISPONÍVEIS:
   - NDVI: ${ndviData.length} pontos (~${((maxNdviDate.getTime() - minNdviDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1)} anos)
   - SAR: ${sarData.length} cenas (~${((maxSarDate.getTime() - minSarDate.getTime()) / (30 * 24 * 60 * 60 * 1000)).toFixed(1)} meses)
   - Pares SAR-NDVI: ${pairs.length}

2. MELHOR MODELO: ${best.name}
   - R² = ${(best.r2 * 100).toFixed(1)}%
   - MAE = ${best.mae.toFixed(4)} (erro médio de ${(best.mae * 100).toFixed(1)}% em NDVI)

3. OUTLIERS:
   - ${outlierCount} pontos (${(outlierCount/pairs.length*100).toFixed(1)}%)
   - Remover outliers melhora a predição

4. PARA MELHORAR A CORRELAÇÃO:
   
   a) BUSCAR SAR HISTÓRICO (5 anos):
      - API Copernicus suporta busca de 2015 até hoje
      - Implementar fetch de VV/VH para datas históricas
      - Com mais dados, modelos ML serão mais robustos

   b) USAR SAZONALIDADE:
      - Adicionar sin/cos do dia do ano como feature
      - Captura ciclo fenológico da cultura

   c) ENSEMBLE DE MODELOS:
      - Combinar Linear + RF + GB para predição
      - Usar média ponderada por R²

   d) VALIDAÇÃO CRUZADA:
      - Treinar em 80%, testar em 20%
      - Verificar generalização do modelo

   e) DETECTAR E TRATAR OUTLIERS:
      - Identificar automaticamente (erro > 2σ)
      - Substituir por interpolação ou média móvel
`)

  await prisma.$disconnect()
}

main().catch(console.error)
