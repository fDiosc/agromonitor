/**
 * Sentinel-1 Radar Service - Geometry and RVI helpers
 */

function getBbox(geometry: any): [number, number, number, number] | null {
  try {
    const geojson = typeof geometry === 'string' ? JSON.parse(geometry) : geometry
    let coords: number[][][] = []

    if (geojson.type === 'FeatureCollection') {
      coords = geojson.features[0]?.geometry?.coordinates || []
    } else if (geojson.type === 'Feature') {
      coords = geojson.geometry?.coordinates || []
    } else if (geojson.type === 'Polygon') {
      coords = geojson.coordinates || []
    }

    if (coords.length === 0 || coords[0].length === 0) return null

    const ring = coords[0]
    let minLon = Infinity, maxLon = -Infinity
    let minLat = Infinity, maxLat = -Infinity

    for (const point of ring) {
      minLon = Math.min(minLon, point[0])
      maxLon = Math.max(maxLon, point[0])
      minLat = Math.min(minLat, point[1])
      maxLat = Math.max(maxLat, point[1])
    }

    return [minLon, minLat, maxLon, maxLat]
  } catch {
    return null
  }
}

/**
 * Extrai polígono GeoJSON da geometria
 */
function getPolygon(geometry: any): any | null {
  try {
    const geojson = typeof geometry === 'string' ? JSON.parse(geometry) : geometry

    if (geojson.type === 'FeatureCollection') {
      return geojson.features[0]?.geometry || null
    } else if (geojson.type === 'Feature') {
      return geojson.geometry || null
    } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
      return geojson
    }
    return null
  } catch {
    return null
  }
}

/**
 * Calcula DpRVI (Dual-pol Radar Vegetation Index) a partir de VH e VV
 *
 * Fórmula correta para Sentinel-1 (RVI4S1):
 *   q = VH_lin / VV_lin (ratio)
 *   DpRVI = q(q+3) / (q+1)²
 *
 * Esta fórmula naturalmente varia de 0 a 1:
 *   - q → 0 (solo exposto): DpRVI → 0
 *   - q → 1 (vegetação densa): DpRVI → 1
 *
 * Referência: Mandal et al. (2020), Bhogapurapu et al. (2022)
 * Script oficial: https://custom-scripts.sentinel-hub.com/sentinel-1/radar_vegetation_index/
 */
function calculateRVI(vhDb: number, vvDb: number): number {
  // Converter de dB para linear (potência)
  const vhLin = Math.pow(10, vhDb / 10)
  const vvLin = Math.pow(10, vvDb / 10)

  // Evitar divisão por zero
  if (vvLin < 1e-10) return 1

  // Ratio q = VH/VV (em linear)
  const q = vhLin / vvLin

  // DpRVI = q(q+3) / (q+1)²
  const numerator = q * (q + 3)
  const denominator = (q + 1) * (q + 1)

  const rvi = numerator / denominator

  return Math.max(0, Math.min(1, rvi))
}

export { getBbox, getPolygon, calculateRVI }
