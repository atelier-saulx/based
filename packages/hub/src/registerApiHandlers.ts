import { DbClient } from '@based/db'
import { deSerialize, serialize } from '@based/schema'
import { readStream } from '@saulx/utils'

export function registerApiHandlers(server, configDb: DbClient) {
  server.functions.add({
    'based:set-function': {
      type: 'stream',
      async fn(_based, { stream, payload }) {
        const contents = await readStream(stream)
        await configDb.upsert('function', {
          name: payload.config.name,
          type: payload.config.type,
          contents: contents.toString(),
          config: payload.config,
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
          console.log('obj', obj)
          update(obj)
        })
      },
    },
  })
}
