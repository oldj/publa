import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3'
import type { StorageProvider } from './index'

export interface R2Config {
  accountId: string
  bucket: string
  accessKey: string
  secretKey: string
}

export class R2Storage implements StorageProvider {
  private client: S3Client
  private bucket: string

  constructor(config: R2Config) {
    this.bucket = config.bucket
    this.client = new S3Client({
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    })
  }

  private normalizeKey(key: string) {
    return key.startsWith('/') ? key.slice(1) : key
  }

  private extractError(err: any): string {
    const parts: string[] = []
    if (err.name && err.name !== 'Error') parts.push(err.name)
    if (err.Code) parts.push(err.Code)
    if (err.message && err.message !== 'UnknownError') parts.push(err.message)
    if (err.$metadata?.httpStatusCode) parts.push(`HTTP ${err.$metadata.httpStatusCode}`)
    if (err.cause?.message) parts.push(err.cause.message)
    if (err.cause?.code) parts.push(err.cause.code)

    if (parts.length === 0) {
      console.error('[R2] Unknown error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
      return 'Unknown error (see server logs)'
    }
    return parts.join(' - ')
  }

  async save(file: Buffer, key: string, mimeType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.normalizeKey(key),
        Body: file,
        ContentType: mimeType,
      }),
    )
    return { key }
  }

  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.normalizeKey(key),
      }),
    )
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.normalizeKey(key),
        }),
      )
      return true
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false
      }
      throw err
    }
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    const sourceKey = this.normalizeKey(fromKey)
    const encodedSource = `${this.bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: encodedSource,
        Key: this.normalizeKey(toKey),
      }),
    )
    await this.delete(fromKey)
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      return { success: true }
    } catch (err: any) {
      return { success: false, message: this.extractError(err) }
    }
  }
}
