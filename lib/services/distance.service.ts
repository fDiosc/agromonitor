/**
 * Serviço de cálculo de distância
 * Suporta cálculo em linha reta (Haversine) e distância rodoviária (Google Maps)
 */

const EARTH_RADIUS_KM = 6371

/**
 * Converte graus para radianos
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Calcula distância em linha reta usando a fórmula de Haversine
 * @returns Distância em quilômetros
 */
export function calculateStraightLineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

/**
 * Calcula distância rodoviária usando Google Maps Distance Matrix API
 * @returns Distância em quilômetros
 */
export async function calculateRoadDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  apiKey: string
): Promise<number> {
  const origin = `${lat1},${lng1}`
  const destination = `${lat2},${lng2}`

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.status !== 'OK') {
      console.error('Google Maps API error:', data.status, data.error_message)
      // Fallback para linha reta
      return calculateStraightLineDistance(lat1, lng1, lat2, lng2)
    }

    const element = data.rows?.[0]?.elements?.[0]
    if (element?.status !== 'OK') {
      console.error('Route not found:', element?.status)
      // Fallback para linha reta
      return calculateStraightLineDistance(lat1, lng1, lat2, lng2)
    }

    // Distância em metros, converter para km
    return element.distance.value / 1000
  } catch (error) {
    console.error('Error calling Google Maps API:', error)
    // Fallback para linha reta
    return calculateStraightLineDistance(lat1, lng1, lat2, lng2)
  }
}

/**
 * Interface para configuração de cálculo de distância
 */
export interface DistanceConfig {
  method: 'straight_line' | 'road_distance'
  googleMapsApiKey?: string
}

/**
 * Calcula distância usando o método configurado
 * @returns Distância em quilômetros
 */
export async function calculateDistance(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  config: DistanceConfig
): Promise<number> {
  if (config.method === 'road_distance' && config.googleMapsApiKey) {
    return calculateRoadDistance(
      from.lat,
      from.lng,
      to.lat,
      to.lng,
      config.googleMapsApiKey
    )
  }

  // Default: linha reta
  return calculateStraightLineDistance(from.lat, from.lng, to.lat, to.lng)
}

/**
 * Calcula distâncias em batch para múltiplos destinos
 * Útil para encontrar a caixa logística mais próxima
 */
export async function calculateDistancesToMany(
  origin: { lat: number; lng: number },
  destinations: { id: string; lat: number; lng: number }[],
  config: DistanceConfig
): Promise<{ id: string; distance: number }[]> {
  const results: { id: string; distance: number }[] = []

  for (const dest of destinations) {
    const distance = await calculateDistance(origin, { lat: dest.lat, lng: dest.lng }, config)
    results.push({ id: dest.id, distance })
  }

  // Ordenar por distância
  results.sort((a, b) => a.distance - b.distance)

  return results
}

/**
 * Encontra a unidade logística mais próxima de um ponto
 */
export function findNearestUnit<T extends { id: string; latitude: number | null; longitude: number | null; coverageRadiusKm: number | null }>(
  point: { lat: number; lng: number },
  units: T[]
): { unit: T; distance: number } | null {
  let nearest: { unit: T; distance: number } | null = null

  for (const unit of units) {
    if (unit.latitude === null || unit.longitude === null) continue

    const distance = calculateStraightLineDistance(
      point.lat,
      point.lng,
      unit.latitude,
      unit.longitude
    )

    // Verificar se está dentro do raio (se definido)
    if (unit.coverageRadiusKm !== null && distance > unit.coverageRadiusKm) {
      continue
    }

    if (nearest === null || distance < nearest.distance) {
      nearest = { unit, distance }
    }
  }

  return nearest
}

/**
 * Encontra todas as unidades que cobrem um ponto
 */
export function findCoveringUnits<T extends { id: string; latitude: number | null; longitude: number | null; coverageRadiusKm: number | null }>(
  point: { lat: number; lng: number },
  units: T[]
): { unit: T; distance: number }[] {
  const covering: { unit: T; distance: number }[] = []

  for (const unit of units) {
    if (unit.latitude === null || unit.longitude === null) continue

    const distance = calculateStraightLineDistance(
      point.lat,
      point.lng,
      unit.latitude,
      unit.longitude
    )

    // Sem raio = cobre tudo, ou está dentro do raio
    if (unit.coverageRadiusKm === null || distance <= unit.coverageRadiusKm) {
      covering.push({ unit, distance })
    }
  }

  // Ordenar por distância
  covering.sort((a, b) => a.distance - b.distance)

  return covering
}
