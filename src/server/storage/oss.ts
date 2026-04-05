import OSS from 'ali-oss'
import type { StorageProvider } from './index'

export interface OSSConfig {
  region: string
  bucket: string
  accessKeyId: string
  accessKeySecret: string
}

export class OSSStorage implements StorageProvider {
  private client: OSS
  private bucket: string

  constructor(config: OSSConfig) {
    this.bucket = config.bucket
    this.client = new OSS({
      region: config.region,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    })
  }

  async save(file: Buffer, key: string, mimeType: string) {
    const normalizedKey = key.startsWith('/') ? key.slice(1) : key
    await this.client.put(normalizedKey, file, {
      headers: { 'Content-Type': mimeType },
    })
    return { key }
  }

  async delete(key: string) {
    const normalizedKey = key.startsWith('/') ? key.slice(1) : key
    await this.client.delete(normalizedKey)
  }

  async exists(key: string): Promise<boolean> {
    const normalizedKey = key.startsWith('/') ? key.slice(1) : key
    try {
      await this.client.head(normalizedKey)
      return true
    } catch (err: any) {
      if (err.status === 404 || err.code === 'NoSuchKey') {
        return false
      }
      throw err
    }
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    const normalizedFrom = fromKey.startsWith('/') ? fromKey.slice(1) : fromKey
    const normalizedTo = toKey.startsWith('/') ? toKey.slice(1) : toKey
    await this.client.copy(normalizedTo, normalizedFrom)
    await this.client.delete(normalizedFrom)
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      await this.client.getBucketInfo(this.bucket)
      return { success: true }
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection failed' }
    }
  }
}
