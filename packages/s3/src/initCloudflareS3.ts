import { S3 } from '@aws-sdk/client-s3'
import { Upload, Options } from '@aws-sdk/lib-storage'
import { S3Client } from './index.js'

export const initCloudflareS3 = (
  accessKeyId: string,
  secretAccessKey: string,
  cloudflareAccountId: string,
) => {
  const client = new S3({
    region: 'auto',
    endpoint: `https://${cloudflareAccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  })

  // inject header to tell cloudflare to create the bucket if doesnt exist
  client.middlewareStack.add(
    (next) => (opts: any) => {
      const headers = opts.request?.headers
      if (headers) {
        headers['cf-create-bucket-if-missing'] = 'true'
      }
      return next(opts)
    },
    { step: 'build' },
  )

  // add upload for backwards compat with v2 TODO: check if this is complete
  // @ts-ignore
  client.upload = async (params: Options['params']) => {
    const uploading = new Upload({
      client,
      params,
    })
    return uploading.done()
  }

  return client as S3Client
}
