import { stat } from 'fs/promises'
import { join } from 'path'
import { createRequire } from 'node:module'

let require = global.require

export const initLocalS3 = (localS3Dir: string) => {
  require ??= createRequire(import.meta.url)
  // mock aws
  const aws = require('mock-aws-s3')
  aws.config.basePath = localS3Dir
  const s3 = aws.S3()
  const s3v3: any = {}

  for (const key in s3) {
    if (typeof s3[key] === 'function') {
      s3v3[key] = async (opts, ...args) => {
        if (key === 'headObject' || key === 'getObject') {
          const { mtimeMs } = await stat(
            join(localS3Dir, opts.Bucket, opts.Key),
          )

          if (
            opts.IfUnmodifiedSince &&
            mtimeMs > opts.IfUnmodifiedSince.getTime()
          ) {
            const err = new Error('Object is newer')
            err.name = '412'
            throw err
          }

          if (
            opts.IfModifiedSince &&
            mtimeMs < opts.IfModifiedSince.getTime()
          ) {
            const err = new Error('Object is older')
            err.name = '304'
            throw err
          }
        }
        if (key === 'getObject') {
          const Body = s3[key](opts, ...args).createReadStream()
          return { Body }
        } else {
          if (key === 'upload' || key === 'putObject') {
            try {
              // we enabled auto create bucket
              await s3.createBucket({
                Bucket: opts.Bucket,
              })
            } catch (e) {}
          }
          return s3[key](opts, ...args).promise()
        }
      }
    }
  }

  // add missing method
  s3v3.headBucket = async ({ Bucket, IfUnmodifiedSince }) => {
    const { mtimeMs } = await stat(join(localS3Dir, Bucket))
    if (IfUnmodifiedSince) {
      if (mtimeMs > IfUnmodifiedSince.getTime()) {
        const err = new Error('Object is newer')
        err.name = '412'
        throw err
      }
    }
    return { Etag: ~~(Math.random() * 10e6) }
  }

  s3v3.listObjectsV2 = s3v3.listObjects

  return s3v3
}
