/**
 * Sentinel-1 Radar Service - Statistical API (fetchS1Statistics)
 */

import { getPolygon, calculateRVI } from './helpers'
import type { S1DataPoint } from './types'

const SENTINEL_HUB_STATISTICAL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics'

/**
 * Processa cenas Sentinel-1 usando Statistical API
 * Retorna valores médios de VH e VV por data
 */
export async function fetchS1Statistics(
  accessToken: string,
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<S1DataPoint[]> {
  const polygon = getPolygon(geometry)
  if (!polygon) {
    console.error('[SENTINEL1] Could not extract polygon from geometry')
    return []
  }

  const evalscript = `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["VV", "VH", "dataMask"],
      units: "LINEAR_POWER"
    }],
    output: [
      { id: "vv_linear", bands: 1, sampleType: "FLOAT32" },
      { id: "vh_linear", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  }
}

function evaluatePixel(sample) {
  return {
    vv_linear: [sample.VV],
    vh_linear: [sample.VH],
    dataMask: [sample.dataMask]
  }
}
`

  try {
    const response = await fetch(SENTINEL_HUB_STATISTICAL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          bounds: {
            geometry: polygon,
            properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' }
          },
          data: [{
            type: 'sentinel-1-grd',
            dataFilter: {
              timeRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
              },
              mosaickingOrder: 'mostRecent',
              polarization: 'DV'
            },
            processing: {
              backCoeff: 'GAMMA0_TERRAIN',
              orthorectify: true
            }
          }]
        },
        aggregation: {
          timeRange: {
            from: startDate.toISOString(),
            to: endDate.toISOString()
          },
          aggregationInterval: {
            of: 'P1D'
          },
          evalscript,
          width: 100,
          height: 100
        },
        calculations: {
          default: {}
        }
      }),
      signal: AbortSignal.timeout(120000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[SENTINEL1] Statistical API failed:', response.status, errorText.substring(0, 200))
      return []
    }

    const data = await response.json()
    const dataPoints: S1DataPoint[] = []

    const intervals = data.data || []

    for (const interval of intervals) {
      const dateFrom = interval.interval?.from
      if (!dateFrom) continue

      const date = dateFrom.split('T')[0]
      const outputs = interval.outputs || {}

      const vvStats = outputs.vv_linear?.bands?.B0?.stats
      const vhStats = outputs.vh_linear?.bands?.B0?.stats

      if (vvStats?.mean !== undefined && vhStats?.mean !== undefined) {
        const vvLin = vvStats.mean
        const vhLin = vhStats.mean

        if (vvLin > 0 && vhLin > 0) {
          const vvDb = 10 * Math.log10(vvLin)
          const vhDb = 10 * Math.log10(vhLin)
          const rvi = calculateRVI(vhDb, vvDb)

          dataPoints.push({
            date,
            vv: vvDb,
            vh: vhDb,
            rvi,
            vhVvRatio: vhLin / vvLin
          })
        }
      }
    }

    console.log('[SENTINEL1] Statistical API returned', dataPoints.length, 'data points')

    return dataPoints.sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  } catch (error) {
    console.error('[SENTINEL1] Error fetching statistics:', error)
    return []
  }
}
