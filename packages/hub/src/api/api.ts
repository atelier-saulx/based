import { DbClient } from '@based/db'
import { S3Client } from '@based/s3'
import { deSerialize, serialize } from '@based/schema'
import { readStream } from '@based/utils'
import { v4 as uuid } from 'uuid'
import { authEmail } from './authEmail/index.js'
import { type Opts } from '../index.js'
import { crc32c } from '@based/hash'

export function registerApiHandlers(
  server,
  configDb: DbClient,
  statsDb: DbClient,
  s3: S3Client,
  buckets: Record<'files' | 'backups' | 'dists', string>,
  smtp: Opts['smtp'],
) {
  server.functions.add({
    'based:auth-email': {
      type: 'function',
      public: true,
      fn: authEmail(smtp),
    },
    'based:events': {
      type: 'query',
      async fn(
        _based,
        { search, page }: { search?: string; page: number },
        update,
      ) {
        const q = statsDb
          .query('event')
          .sort('createdAt', 'desc')
          .include(
            'function.name',
            'function.checksum',
            'createdAt',
            'type',
            'msg',
            'level',
            'meta',
          )
        if (search) {
          q.filter('msg', 'has', search)
            .or('msg', 'has', search)
            .or('meta', 'has', search)
        }
        q.range(page * 100, (page + 1) * 100)
        return q.subscribe((res) => {
          const obj = res.toObject()
          update(obj)
        })
      },
    },
    'db:file-upload': {
      type: 'stream',
      async fn(
        based,
        { mimeType, size, stream, fileName, extension, payload = <any>{} },
      ) {
        // DO NOT ADD CONTENTLENGTH, it's broken. it will infer it anyway.
        const {
          Key = `${uuid()}-${uuid()}-${uuid()}.${extension}`,
          Bucket = buckets.files,
        } = payload

        // put stuff in db
        await s3.upload({
          Bucket,
          Key,
          Body: stream,
          ContentType: mimeType,
        })
      },
    },
    'based:secret': {
      type: 'query',
      async fn(_based, name = 'default', update) {
        return configDb.query('secret', { name }).subscribe((res) => {
          const obj = res.toObject()
          update(obj?.value)
        })
      },
    },
    'based:set-secret': {
      type: 'function',
      async fn(_based, payload) {
        const { name, value } = payload
        if (typeof name !== 'string' || name === '') {
          throw new Error('name must be passed in the payload')
        }
        return configDb.upsert('secret', { name, value })
      },
    },
    'based:set-function': {
      type: 'stream',
      async fn(_based, { stream, payload }) {
        const contents = await readStream(stream)
        const code = Buffer.from(contents).toString()
        const config = payload.config
        const checksum =
          config.type === 'app'
            ? crc32c(code + JSON.stringify(config))
            : crc32c(code)

        let { type, name } = config
        if (type === 'authorize') {
          name = 'based:authorize'
          config.name = name
        }

        const res = await configDb
          .query('function', { name })
          .include('id', 'checksum')
          .get()
          .toObject()
        let id: number
        if (res) {
          if (res.checksum === checksum) {
            return
          }
          id = res.id
          await configDb.update('function', id, {
            name,
            type,
            code,
            config,
            checksum,
          })
        } else {
          id = await configDb.create('function', {
            name,
            type,
            code,
            config,
            checksum,
          })
        }
        return new Promise<void>(async (resolve) => {
          const unsubscribe = configDb
            .query('function', id)
            .include('loaded', 'checksum')
            .subscribe((res) => {
              const { loaded, checksum } = res.toObject()
              if (loaded === checksum) {
                resolve()
                unsubscribe()
              }
            })
        })
      },
    },
    'db:set-schema': {
      type: 'function',
      async fn(_based, serializedObject) {
        const { db, schema } = deSerialize(serializedObject) as any
        const id = await configDb.upsert('schema', {
          name: db,
          schema: serialize(schema),
          status: 'pending',
        })
        return new Promise<void>((resolve, reject) => {
          const unsubscribe = configDb
            .query('schema', id)
            .include('status')
            .subscribe((res) => {
              const { status } = res.toObject()
              if (status === 'error') {
                reject(new Error('Schema error'))
                unsubscribe()
              } else if (status === 'ready') {
                resolve()
                unsubscribe()
              }
            })
        })
      },
    },
    'db:schema': {
      type: 'query',
      async fn(_based, name = 'default', update) {
        return configDb.query('schema', { name }).subscribe((res) => {
          const obj = res.toObject()
          obj.schema = deSerialize(obj.schema)
        })
      },
    },
  })
}
