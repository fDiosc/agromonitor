'use client'

import { useMemo } from 'react'

interface FieldPolygonOverlayProps {
  geometryJson: string
  bbox: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
  width: number
  height: number
  strokeColor?: string
  strokeWidth?: number
  fillColor?: string
}

/**
 * SVG overlay that draws the field polygon on top of a satellite image.
 * Converts GeoJSON coordinates to pixel positions using the bbox.
 * Pure visual overlay — does not modify the underlying image.
 */
export function FieldPolygonOverlay({
  geometryJson,
  bbox,
  width,
  height,
  strokeColor = 'rgba(0, 255, 200, 0.85)',
  strokeWidth = 2,
  fillColor = 'rgba(0, 255, 200, 0.08)',
}: FieldPolygonOverlayProps) {
  const polygonPoints = useMemo(() => {
    try {
      const geojson = JSON.parse(geometryJson)
      let coords: number[][][] = []

      if (geojson.type === 'FeatureCollection') {
        coords = geojson.features[0]?.geometry?.coordinates || []
      } else if (geojson.type === 'Feature') {
        coords = geojson.geometry?.coordinates || []
      } else if (geojson.type === 'Polygon') {
        coords = geojson.coordinates || []
      }

      if (coords.length === 0 || coords[0].length === 0) return null

      const [minLon, minLat, maxLon, maxLat] = bbox
      const lonRange = maxLon - minLon
      const latRange = maxLat - minLat

      if (lonRange === 0 || latRange === 0) return null

      // Convert each coordinate [lon, lat] to pixel [x, y]
      // Note: latitude increases upward but pixel Y increases downward
      const ring = coords[0]
      const points = ring.map(([lon, lat]) => {
        const x = ((lon - minLon) / lonRange) * width
        const y = ((maxLat - lat) / latRange) * height
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })

      return points.join(' ')
    } catch {
      return null
    }
  }, [geometryJson, bbox, width, height])

  if (!polygonPoints) return null

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-[5]"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%' }}
    >
      <polygon
        points={polygonPoints}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  )
}
