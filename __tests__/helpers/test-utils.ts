/**
 * Helpers compartilhados para testes
 */

/**
 * Gera uma data no formato ISO string, deslocada N dias a partir de uma data base
 */
export function dateOffset(baseDate: string, days: number): string {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/**
 * Gera uma série de datas igualmente espaçadas
 */
export function generateDateSeries(
  startDate: string,
  intervalDays: number,
  count: number
): string[] {
  return Array.from({ length: count }, (_, i) =>
    dateOffset(startDate, i * intervalDays)
  )
}

/**
 * Cria um NdviPoint (formato Merx) a partir de data e valor NDVI
 */
export function ndviPoint(date: string, value: number) {
  return {
    date,
    ndvi_raw: value + (Math.random() * 0.02 - 0.01), // noise
    ndvi_smooth: value,
    ndvi_interp: value,
    cloud_cover: Math.random() * 20,
  }
}

/**
 * Arredonda para N casas decimais
 */
export function round(value: number, decimals: number = 2): number {
  return Math.round(value * 10 ** decimals) / 10 ** decimals
}
