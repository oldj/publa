import COS from 'cos-nodejs-sdk-v5'
import type { StorageProvider } from './index'

export interface COSConfig {
  region: string
  bucket: string
  secretId: string
  secretKey: string
}

export class COSStorage implements StorageProvider {
  private client: COS
  private bucket: string
  private region: string

  constructor(config: COSConfig) {
    this.bucket = config.bucket
    this.region = config.region
    this.client = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey,
    })
  }

  async save(file: Buffer, key: string, mimeType: string) {
    const normalizedKey = key.startsWith('/') ? key.slice(1) : key
    await this.client.putObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: normalizedKey,
      Body: file,
      ContentType: mimeType,
    })
    return { key }
  }

  async delete(key: string) {
    const normalizedKey = key.startsWith('/') ? key.slice(1) : key
    await this.client.deleteObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: normalizedKey,
    })
  }

  async exists(key: string): Promise<boolean> {
    const normalizedKey = key.startsWith('/') ? key.slice(1) : key
    try {
      await this.client.headObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: normalizedKey,
      })
      return true
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === 'NotFound') {
        return false
      }
      throw err
    }
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    const normalizedFrom = fromKey.startsWith('/') ? fromKey.slice(1) : fromKey
    const normalizedTo = toKey.startsWith('/') ? toKey.slice(1) : toKey
    await this.client.putObjectCopy({
      Bucket: this.bucket,
      Region: this.region,
      Key: normalizedTo,
      CopySource: `${this.bucket}.cos.${this.region}.myqcloud.com/${normalizedFrom}`,
    })
    await this.client.deleteObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: normalizedFrom,
    })
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      await this.client.headBucket({
        Bucket: this.bucket,
        Region: this.region,
      })
      return { success: true }
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection failed' }
    }
  }
}
