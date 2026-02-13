/**
 * Fixtures de séries NDVI realistas para testes.
 * Formato: NdviPoint do merx.service (date, ndvi_raw, ndvi_smooth, ndvi_interp, cloud_cover)
 *
 * Baseadas em padrões reais de satélite Sentinel-2 para culturas no Brasil.
 * Intervalo: 5 dias (frequência típica Sentinel-2)
 */

import type { NdviPoint } from '@/lib/services/merx.service'

// --- Helpers internos ---

function pt(date: string, ndvi: number, cloud?: number): NdviPoint {
  return {
    date,
    ndvi_raw: ndvi,
    ndvi_smooth: ndvi,
    ndvi_interp: ndvi,
    cloud_cover: cloud ?? 10,
  }
}

function generateSeries(
  startDate: string,
  values: number[],
  intervalDays: number = 5
): NdviPoint[] {
  return values.map((v, i) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i * intervalDays)
    return pt(d.toISOString().split('T')[0], v)
  })
}

// ============================================================
// 1. SOJA NORMAL — Ciclo completo saudável (~120 dias)
// Plantio ~01/Out, SOS ~15/Out, Peak ~15/Dez, EOS ~15/Fev
// ============================================================
export const SOJA_NORMAL: NdviPoint[] = generateSeries('2025-10-01', [
  // Solo / pré-emergência
  0.18, 0.20, 0.22, // Out 01, 06, 11
  // Emergência (SOS ≈ Out 16, cruza 0.35)
  0.30, 0.38, 0.48, // Out 16, 21, 26
  // Crescimento vegetativo
  0.58, 0.67, 0.74, // Out 31, Nov 05, Nov 10
  0.78, 0.81, 0.83, // Nov 15, 20, 25
  // Peak (≈ Dez 15, NDVI 0.85)
  0.84, 0.85, 0.85, // Nov 30, Dez 05, Dez 10
  0.85, 0.84, 0.82, // Dez 15, 20, 25
  // Senescência
  0.78, 0.72, 0.65, // Dez 30, Jan 04, Jan 09
  0.55, 0.45, 0.36, // Jan 14, 19, 24
  // Pós-colheita (EOS ≈ Jan 24, cruza 0.38)
  0.28, 0.22, 0.19, // Jan 29, Fev 03, Fev 08
])

// ============================================================
// 2. SOJA COM REPLANTIO — Queda >0.2 + recuperação
// Emergência, falha, destruição, novo plantio
// ============================================================
export const SOJA_REPLANTIO: NdviPoint[] = generateSeries('2025-10-01', [
  // 1º plantio emergência
  0.18, 0.22, 0.32, 0.42, 0.52, // Out 01-21
  // Queda brusca (falha: seca, geada, praga)
  0.38, 0.25, 0.20, // Out 26, 31, Nov 05
  // Recuperação (2º plantio)
  0.22, 0.30, 0.40, 0.52, 0.62, // Nov 10-30
  0.70, 0.76, 0.80, 0.82, 0.83, // Dez 05-25
  // Peak e senescência
  0.82, 0.78, 0.70, 0.58, 0.45, // Dez 30, Jan 04-19
  0.35, 0.26, 0.20, // Jan 24, 29, Fev 03
])

// ============================================================
// 3. MILHO NORMAL — Ciclo completo (~140 dias)
// Peak ligeiramente menor que soja, ciclo mais longo
// ============================================================
export const MILHO_NORMAL: NdviPoint[] = generateSeries('2025-10-01', [
  0.16, 0.18, 0.22, 0.28, // Out 01-16
  // SOS ≈ Out 21 (cruza 0.30)
  0.32, 0.40, 0.50, 0.60, // Out 21, Nov 05
  0.68, 0.73, 0.76, 0.78, // Nov 10-25
  // Peak (≈ Dez 10, NDVI 0.80)
  0.79, 0.80, 0.80, 0.79, // Nov 30, Dez 05-15
  0.78, 0.76, 0.73, 0.68, // Dez 20, Jan 04
  // Senescência mais lenta que soja
  0.62, 0.55, 0.48, 0.40, // Jan 09-24
  // EOS ≈ Jan 29 (cruza 0.35)
  0.33, 0.27, 0.22, 0.18, // Jan 29, Fev 03-13
])

// ============================================================
// 4. NO_CROP — Solo exposto / pastagem degradada
// NDVI sempre abaixo de 0.45, sem ciclo detectável
// ============================================================
export const NO_CROP: NdviPoint[] = generateSeries('2025-10-01', [
  0.22, 0.24, 0.23, 0.25, 0.26,
  0.28, 0.30, 0.32, 0.33, 0.34,
  0.35, 0.33, 0.31, 0.30, 0.28,
  0.26, 0.25, 0.24, 0.23, 0.22,
  0.21, 0.20, 0.19, 0.20,
])

// ============================================================
// 5. ANOMALOUS — Peak muito baixo para soja (0.52)
// Cultura pode existir mas com performance muito ruim
// ============================================================
export const ANOMALOUS: NdviPoint[] = generateSeries('2025-10-01', [
  0.18, 0.20, 0.24, 0.30, 0.35,
  0.40, 0.44, 0.48, 0.50, 0.52,
  0.52, 0.51, 0.49, 0.46, 0.42,
  0.38, 0.34, 0.30, 0.26, 0.22,
  0.20, 0.19, 0.18, 0.18,
])

// ============================================================
// 6. ATYPICAL — Amplitude baixa, SOS/EOS indefinidos
// Vegetação presente mas sem ciclo anual claro
// ============================================================
export const ATYPICAL: NdviPoint[] = generateSeries('2025-10-01', [
  0.40, 0.42, 0.45, 0.48, 0.50,
  0.52, 0.55, 0.58, 0.60, 0.62,
  0.63, 0.62, 0.60, 0.58, 0.56,
  0.54, 0.52, 0.50, 0.48, 0.46,
  0.44, 0.42, 0.41, 0.40,
])

// ============================================================
// 7. CLOUD_GAPS — Série com lacunas >15 dias (nuvens)
// Dados reais mas com buracos
// ============================================================
export const CLOUD_GAPS: NdviPoint[] = [
  pt('2025-10-01', 0.20),
  pt('2025-10-06', 0.25),
  pt('2025-10-11', 0.32),
  // GAP: 20 dias sem dados (nuvens)
  pt('2025-11-01', 0.62),
  pt('2025-11-06', 0.70),
  pt('2025-11-11', 0.76),
  pt('2025-11-16', 0.80),
  pt('2025-11-21', 0.83),
  // GAP: 15 dias sem dados
  pt('2025-12-06', 0.84),
  pt('2025-12-11', 0.82),
  pt('2025-12-16', 0.78),
  pt('2025-12-21', 0.72),
  pt('2025-12-26', 0.65),
  pt('2025-12-31', 0.55),
  pt('2026-01-05', 0.42),
  pt('2026-01-10', 0.30),
  pt('2026-01-15', 0.22),
]

// ============================================================
// 8. SENESCENCE_ACTIVE — Planta em queda ativa
// Slope < -0.005/dia, útil para testar projeção exponencial
// ============================================================
export const SENESCENCE_ACTIVE: NdviPoint[] = generateSeries('2025-10-01', [
  // Crescimento completo
  0.20, 0.30, 0.42, 0.55, 0.65,
  0.73, 0.78, 0.82, 0.84, 0.85,
  // Início da senescência: NDVI em queda constante
  0.83, 0.80, 0.76, 0.71, 0.65,
  0.58, 0.50, // Série termina aqui — senescência em progresso
])

// ============================================================
// Séries históricas para correlação
// 3 safras anteriores (padrão de referência)
// ============================================================
export const HISTORICAL_SOJA_1: NdviPoint[] = generateSeries('2024-10-01', [
  0.19, 0.21, 0.24, 0.32, 0.40,
  0.52, 0.64, 0.73, 0.79, 0.83,
  0.85, 0.86, 0.85, 0.83, 0.80,
  0.74, 0.65, 0.54, 0.42, 0.33,
  0.25, 0.20, 0.18, 0.17,
])

export const HISTORICAL_SOJA_2: NdviPoint[] = generateSeries('2023-10-01', [
  0.17, 0.20, 0.23, 0.30, 0.38,
  0.50, 0.62, 0.71, 0.78, 0.82,
  0.84, 0.84, 0.83, 0.81, 0.77,
  0.70, 0.62, 0.50, 0.40, 0.32,
  0.24, 0.19, 0.17, 0.16,
])

export const HISTORICAL_SOJA_3: NdviPoint[] = generateSeries('2022-10-01', [
  0.18, 0.19, 0.22, 0.29, 0.37,
  0.48, 0.60, 0.70, 0.77, 0.81,
  0.83, 0.84, 0.83, 0.80, 0.76,
  0.69, 0.60, 0.48, 0.38, 0.30,
  0.23, 0.19, 0.17, 0.16,
])
