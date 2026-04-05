import { getSetting } from '@/server/services/settings'

export interface StorageProvider {
  save(file: Buffer, key: string, mimeType: string): Promise<{ key: string }>
  delete(key: string): Promise<void>
  /** 检查远程是否已存在指定 key 的文件 */
  exists(key: string): Promise<boolean>
  /** 将文件从 fromKey 移动到 toKey（copy + delete） */
  move(fromKey: string, toKey: string): Promise<void>
  testConnection(): Promise<{ success: boolean; message?: string }>
}

/** 从 settings 读取当前配置并返回对应存储实例，未配置时返回 null */
export async function getStorageProvider(): Promise<StorageProvider | null> {
  const provider = await getSetting('storageProvider')
  if (!provider) return null

  if (provider === 's3') {
    const { S3Storage } = await import('./s3')
    const endpoint = await getSetting('storageS3Endpoint')
    const region = await getSetting('storageS3Region')
    const bucket = await getSetting('storageS3Bucket')
    const accessKey = await getSetting('storageS3AccessKey')
    const secretKey = await getSetting('storageS3SecretKey')
    if (!endpoint || !bucket || !accessKey || !secretKey) return null
    return new S3Storage({ endpoint, region: region || 'us-east-1', bucket, accessKey, secretKey })
  }

  if (provider === 'oss') {
    const { OSSStorage } = await import('./oss')
    const region = await getSetting('storageOssRegion')
    const bucket = await getSetting('storageOssBucket')
    const accessKeyId = await getSetting('storageOssAccessKeyId')
    const accessKeySecret = await getSetting('storageOssAccessKeySecret')
    if (!region || !bucket || !accessKeyId || !accessKeySecret) return null
    return new OSSStorage({ region, bucket, accessKeyId, accessKeySecret })
  }

  if (provider === 'cos') {
    const { COSStorage } = await import('./cos')
    const region = await getSetting('storageCosRegion')
    const bucket = await getSetting('storageCosBucket')
    const secretId = await getSetting('storageCosSecretId')
    const secretKey = await getSetting('storageCosSecretKey')
    if (!region || !bucket || !secretId || !secretKey) return null
    return new COSStorage({ region, bucket, secretId, secretKey })
  }

  if (provider === 'r2') {
    const { R2Storage } = await import('./r2')
    const accountId = await getSetting('storageR2AccountId')
    const bucket = await getSetting('storageR2Bucket')
    const accessKey = await getSetting('storageR2AccessKey')
    const secretKey = await getSetting('storageR2SecretKey')
    if (!accountId || !bucket || !accessKey || !secretKey) return null
    return new R2Storage({ accountId, bucket, accessKey, secretKey })
  }

  return null
}

/** 根据指定 provider 和配置创建实例（用于测试连接） */
export async function createStorageProvider(
  provider: string,
  config: Record<string, string>,
): Promise<StorageProvider | null> {
  if (provider === 's3') {
    const { S3Storage } = await import('./s3')
    if (!config.endpoint || !config.bucket || !config.accessKey || !config.secretKey) return null
    return new S3Storage({
      endpoint: config.endpoint,
      region: config.region || 'us-east-1',
      bucket: config.bucket,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    })
  }

  if (provider === 'oss') {
    const { OSSStorage } = await import('./oss')
    if (!config.region || !config.bucket || !config.accessKeyId || !config.accessKeySecret)
      return null
    return new OSSStorage({
      region: config.region,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
    })
  }

  if (provider === 'cos') {
    const { COSStorage } = await import('./cos')
    if (!config.region || !config.bucket || !config.secretId || !config.secretKey) return null
    return new COSStorage({
      region: config.region,
      bucket: config.bucket,
      secretId: config.secretId,
      secretKey: config.secretKey,
    })
  }

  if (provider === 'r2') {
    const { R2Storage } = await import('./r2')
    if (!config.accountId || !config.bucket || !config.accessKey || !config.secretKey) return null
    return new R2Storage({
      accountId: config.accountId,
      bucket: config.bucket,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    })
  }

  return null
}
