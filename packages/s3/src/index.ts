import {
  AbortMultipartUploadCommandOutput,
  CompleteMultipartUploadCommandOutput,
  S3,
} from '@aws-sdk/client-s3'
import { Options } from '@aws-sdk/lib-storage'
import { initAwsS3 } from './initAwsS3.js'
import { initCloudflareS3 } from './initCloudflareS3.js'
import { initLocalS3 } from './initLocalS3.js'

export type S3Client = S3 & {
  upload: (
    params: Options['params'],
  ) => Promise<
    CompleteMultipartUploadCommandOutput | AbortMultipartUploadCommandOutput
  >
}

const clients: Map<string, S3Client> = new Map()

export type S3Opts =
  | {
      provider: 'local'
      localS3Dir: string
      accessKeyId?: never
      secretAccessKey?: never
      cloudflareAccountId?: never
    }
  | {
      provider: 'aws'
      localS3Dir?: never
      accessKeyId: string
      secretAccessKey: string
      cloudflareAccountId?: never
    }
  | {
      provider: 'cf'
      localS3Dir?: never
      accessKeyId: string
      secretAccessKey: string
      cloudflareAccountId: string
    }

export const initS3 = (opts: S3Opts): S3Client => {
  const {
    provider,
    accessKeyId,
    secretAccessKey,
    cloudflareAccountId,
    localS3Dir,
  } = opts
  const key = provider + accessKeyId
  if (!clients.has(key)) {
    if (provider === 'local') {
      clients.set(key, initLocalS3(localS3Dir))
    } else if (provider === 'cf') {
      clients.set(
        key,
        initCloudflareS3(accessKeyId, secretAccessKey, cloudflareAccountId),
      )
    } else if (provider === 'aws') {
      clients.set(key, initAwsS3(accessKeyId, secretAccessKey))
    }
  }
  return clients.get(key)
}
