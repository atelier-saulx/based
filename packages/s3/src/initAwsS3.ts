import { S3 } from '@aws-sdk/client-s3'
import { Upload, Options } from '@aws-sdk/lib-storage'
import { S3Client } from './index.js'
import { wait } from '@based/utils'

export const initAwsS3 = (accessKeyId: string, secretAccessKey: string) => {
  const client = new S3({
    region: 'eu-central-1',
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
  })

  const creating: Record<string, Promise<any>> = {}
  // add upload for backwards compat with v2 TODO: check if this is complete
  // @ts-ignore
  client.upload = async (params: Options['params']) => {
    const { Bucket } = params
    if (!Bucket) {
      throw new Error('Bucket required')
    }
    const bucketExists = await client
      .headBucket({ Bucket })
      .then(() => true)
      .catch(() => false)

    if (!bucketExists) {
      if (!(Bucket in creating)) {
        creating[Bucket] = client
          .createBucket({ Bucket: Bucket })
          .then(() => wait(1e3))
          .finally(() => {
            delete creating[Bucket]
          })
      }
      await creating[Bucket]
    }

    const uploading = new Upload({
      client,
      params,
    })

    return uploading.done()
  }

  return client as S3Client
}
