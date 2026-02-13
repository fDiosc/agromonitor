/**
 * AWS S3 Storage Client
 * Used for persisting satellite images with workspace segregation
 * 
 * Path structure:
 *   {bucket}/agro-monitor/{workspaceId}/fields/{fieldId}/{date}_{type}_{collection}.png
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner'

// ==================== Client ====================

const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
}

// Only set endpoint if explicitly provided (R2, MinIO, etc.)
// For standard AWS S3, no endpoint is needed
if (process.env.S3_ENDPOINT) {
  clientConfig.endpoint = process.env.S3_ENDPOINT
  clientConfig.forcePathStyle = true
}

const s3Client = new S3Client(clientConfig)

export const BUCKET = process.env.S3_BUCKET || 'pocs-merxlabs'

/** App-level prefix inside the bucket */
const APP_PREFIX = 'agro-monitor'

// ==================== Helpers ====================

/**
 * Check if S3 is configured (required env vars present)
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET
  )
}

/**
 * Build S3 key for a satellite image
 * Path: agro-monitor/{workspaceId}/fields/{fieldId}/{date}_{type}_{collection}.png
 */
export function buildImageKey(
  workspaceId: string,
  fieldId: string,
  date: string,
  type: string,
  collection: string
): string {
  return `${APP_PREFIX}/${workspaceId}/fields/${fieldId}/${date}_${type}_${collection}.png`
}

// ==================== Operations ====================

/**
 * Upload an image buffer to S3
 */
export async function uploadImage(
  key: string,
  buffer: Buffer,
  contentType = 'image/png'
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  )
}

/**
 * Download an image from S3 as Buffer
 */
export async function downloadImage(key: string): Promise<Buffer | null> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    )

    if (!response.Body) return null

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    const stream = response.Body as AsyncIterable<Uint8Array>
    for await (const chunk of stream) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      return null
    }
    throw error
  }
}

/**
 * Generate a pre-signed URL for reading an image
 * @param key S3 object key
 * @param expiresIn URL expiry in seconds (default: 1 hour)
 */
export async function getPresignedUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  return s3GetSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Delete an image from S3
 */
export async function deleteImage(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )
}
