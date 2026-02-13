/**
 * Field Images Service (Shared)
 * 
 * Central service for satellite image persistence.
 * Used by both AI Validation and Visual Analysis.
 * 
 * - Images are stored in S3 (workspace-segregated)
 * - Metadata is stored in PostgreSQL (FieldImage model)
 * - Incremental fetch: only fetches dates not already stored
 */

import { prisma } from '@/lib/prisma'
import { processImage, searchCatalogCloudCover } from './sentinel1.service'
import {
  uploadImage,
  downloadImage,
  getPresignedUrl,
  buildImageKey,
  isS3Configured,
} from '@/lib/s3'
import {
  EVALSCRIPT_TRUE_COLOR,
  EVALSCRIPT_NDVI,
  EVALSCRIPT_RADAR,
  EVALSCRIPT_LANDSAT_NDVI,
  EVALSCRIPT_S3_NDVI,
} from '@/lib/evalscripts'
import type { FieldImage } from '@prisma/client'
import type { AgenticImageEntry, ImageType, SatelliteCollection } from '@/lib/agents/types'

// ==================== Types ====================

interface ImageFetchPlan {
  dateFrom: string
  dateTo: string
  collection: string
  evalscript: string
  type: string
}

export interface FetchOptions {
  source: 'ai-validation' | 'visual-analysis' | 'process'
  includeRadar?: boolean
  includeLandsat?: boolean
  includeS3Ndvi?: boolean
  seasonStart?: string
  endDate?: string
}

export interface FieldImagesResult {
  images: FieldImage[]
  newCount: number
  totalCount: number
}

// ==================== Geometry Helpers ====================

/**
 * Build a bounding box from GeoJSON geometry
 */
export function getBboxFromGeometry(geometryJson: string): [number, number, number, number] | null {
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

// ==================== Date Range Generation ====================

/**
 * Generate date ranges for image fetching (every ~10 days from season start to end)
 */
function generateDateRanges(
  seasonStart: string,
  endDate?: string
): Array<{ from: string; to: string }> {
  const start = new Date(seasonStart)
  const end = endDate ? new Date(endDate) : new Date()
  const ranges: Array<{ from: string; to: string }> = []

  const current = new Date(start)
  while (current < end) {
    const rangeEnd = new Date(current)
    rangeEnd.setDate(rangeEnd.getDate() + 5)
    if (rangeEnd > end) rangeEnd.setTime(end.getTime())

    ranges.push({
      from: current.toISOString().split('T')[0] + 'T00:00:00Z',
      to: rangeEnd.toISOString().split('T')[0] + 'T23:59:59Z',
    })

    current.setDate(current.getDate() + 10)
  }

  return ranges
}

// ==================== Fetch Plan Builder ====================

/**
 * Build fetch plans based on date ranges and options
 * Same logic as ai-validation.service.ts fetchImages, unified here
 */
function buildFetchPlans(
  dateRanges: Array<{ from: string; to: string }>,
  options: FetchOptions
): ImageFetchPlan[] {
  const plans: ImageFetchPlan[] = []

  for (const range of dateRanges) {
    // S2 True Color (always)
    plans.push({
      dateFrom: range.from,
      dateTo: range.to,
      collection: 'sentinel-2-l2a',
      evalscript: EVALSCRIPT_TRUE_COLOR,
      type: 'truecolor',
    })
    // S2 NDVI (always)
    plans.push({
      dateFrom: range.from,
      dateTo: range.to,
      collection: 'sentinel-2-l2a',
      evalscript: EVALSCRIPT_NDVI,
      type: 'ndvi',
    })
    // Radar (optional, used by AI validation)
    if (options.includeRadar) {
      plans.push({
        dateFrom: range.from,
        dateTo: range.to,
        collection: 'sentinel-1-grd',
        evalscript: EVALSCRIPT_RADAR,
        type: 'radar',
      })
    }
  }

  // Landsat NDVI at sparser intervals (every other range)
  if (options.includeLandsat) {
    for (let i = 0; i < dateRanges.length; i += 2) {
      const range = dateRanges[i]
      plans.push({
        dateFrom: range.from,
        dateTo: range.to,
        collection: 'landsat-ot-l1',
        evalscript: EVALSCRIPT_LANDSAT_NDVI,
        type: 'landsat-ndvi',
      })
    }
  }

  // S3 NDVI at even sparser intervals (every third range)
  if (options.includeS3Ndvi) {
    for (let i = 0; i < dateRanges.length; i += 3) {
      const range = dateRanges[i]
      plans.push({
        dateFrom: range.from,
        dateTo: range.to,
        collection: 'sentinel-3-olci',
        evalscript: EVALSCRIPT_S3_NDVI,
        type: 's3-ndvi',
      })
    }
  }

  return plans
}

// ==================== Core Service Functions ====================

/**
 * Get all stored images for a field from DB
 */
export async function getStoredImages(fieldId: string): Promise<FieldImage[]> {
  return prisma.fieldImage.findMany({
    where: { fieldId },
    orderBy: { date: 'asc' },
  })
}

/**
 * Fetch missing images from CDSE, upload to S3, save metadata to DB
 * Returns only the newly fetched images
 */
export async function fetchAndStoreNewImages(
  workspaceId: string,
  fieldId: string,
  bbox: [number, number, number, number],
  options: FetchOptions
): Promise<{ newImages: FieldImage[]; fetchedCount: number }> {
  // 1. Get already stored images
  const stored = await getStoredImages(fieldId)
  const existingKeys = new Set(
    stored.map(img => `${img.date}_${img.type}_${img.collection}`)
  )

  // 2. Generate date ranges
  const seasonStart = options.seasonStart
    || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const dateRanges = generateDateRanges(seasonStart, options.endDate)

  // 3. Build all fetch plans
  const allPlans = buildFetchPlans(dateRanges, options)

  // 4. Filter out already-stored combinations (incremental)
  const missingPlans = allPlans.filter(plan => {
    const date = plan.dateFrom.split('T')[0]
    const key = `${date}_${plan.type}_${plan.collection}`
    return !existingKeys.has(key)
  })

  if (missingPlans.length === 0) {
    console.log(`[FIELD-IMAGES] No new images to fetch for field ${fieldId}`)
    return { newImages: [], fetchedCount: 0 }
  }

  console.log(`[FIELD-IMAGES] Fetching ${missingPlans.length} new images (${allPlans.length - missingPlans.length} already stored)`)

  const s3Available = isS3Configured()
  const newImages: FieldImage[] = []

  // 5. Fetch in batches of 5
  const BATCH_SIZE = 5
  for (let i = 0; i < missingPlans.length; i += BATCH_SIZE) {
    const batch = missingPlans.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (plan) => {
        const buffer = await processImage(workspaceId, {
          bbox,
          dateFrom: plan.dateFrom,
          dateTo: plan.dateTo,
          evalscript: plan.evalscript,
          dataCollection: plan.collection,
          width: 512,
          height: 512,
        })
        if (!buffer) return null

        const date = plan.dateFrom.split('T')[0]
        const s3Key = buildImageKey(workspaceId, fieldId, date, plan.type, plan.collection)

        // Fetch cloud coverage from Sentinel Hub Catalog (optical only)
        const cloudCoverage = await searchCatalogCloudCover(workspaceId, {
          bbox,
          dateFrom: plan.dateFrom,
          dateTo: plan.dateTo,
          collection: plan.collection,
        })

        // Upload to S3 if configured
        if (s3Available) {
          await uploadImage(s3Key, buffer)
        }

        // Save metadata to DB
        const record = await prisma.fieldImage.upsert({
          where: {
            fieldId_date_type_collection: {
              fieldId,
              date,
              type: plan.type,
              collection: plan.collection,
            },
          },
          create: {
            fieldId,
            date,
            type: plan.type,
            collection: plan.collection,
            s3Key,
            width: 512,
            height: 512,
            sizeBytes: buffer.length,
            cloudCoverage,
            source: options.source,
          },
          update: {
            s3Key,
            sizeBytes: buffer.length,
            cloudCoverage,
            source: options.source,
          },
        })

        return record
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        newImages.push(result.value)
      }
    }

    // Rate limit delay between batches
    if (i + BATCH_SIZE < missingPlans.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  console.log(`[FIELD-IMAGES] Stored ${newImages.length}/${missingPlans.length} new images`)
  return { newImages, fetchedCount: newImages.length }
}

/**
 * Main entry point: get all images for a field (stored + fetch new)
 * This is what consumers should call
 */
export async function getFieldImages(
  fieldId: string,
  workspaceId: string,
  geometryJson: string,
  options: FetchOptions
): Promise<FieldImagesResult> {
  const bbox = getBboxFromGeometry(geometryJson)
  if (!bbox) {
    throw new Error('Could not extract bounding box from field geometry')
  }

  // Fetch and store any new images (incremental)
  const { fetchedCount } = await fetchAndStoreNewImages(
    workspaceId,
    fieldId,
    bbox,
    options
  )

  // Return all images (existing + newly fetched)
  const allImages = await getStoredImages(fieldId)

  return {
    images: allImages,
    newCount: fetchedCount,
    totalCount: allImages.length,
  }
}

// ==================== Output Formatters ====================

/**
 * Download images from S3 and return as base64 (for AI pipeline / Gemini)
 * Maps to AgenticImageEntry format expected by Curator/Verifier/Judge
 */
export async function getImagesAsBase64(
  images: FieldImage[],
  bbox: [number, number, number, number]
): Promise<AgenticImageEntry[]> {
  const s3Available = isS3Configured()
  const entries: AgenticImageEntry[] = []

  for (const img of images) {
    if (!s3Available) continue

    const buffer = await downloadImage(img.s3Key)
    if (!buffer) continue

    entries.push({
      date: img.date,
      type: img.type as ImageType,
      base64: buffer.toString('base64'),
      metadata: {
        collection: img.collection,
        bbox: [...bbox],
      },
    })
  }

  return entries
}

/**
 * Generate pre-signed URLs for frontend display
 */
export async function getImageUrls(
  images: FieldImage[]
): Promise<Array<FieldImage & { url: string }>> {
  const s3Available = isS3Configured()

  return Promise.all(
    images.map(async (img) => {
      const url = s3Available
        ? await getPresignedUrl(img.s3Key)
        : '' // No URL when S3 not configured
      return { ...img, url }
    })
  )
}

/**
 * Get unique dates from a list of field images
 */
export function getUniqueDates(images: FieldImage[]): string[] {
  const dates = new Set(images.map(img => img.date))
  return Array.from(dates).sort()
}
