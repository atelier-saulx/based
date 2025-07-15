import { DbClient } from '@based/db'
import { BasedFunctionConfigs } from '@based/functions'
import { readStream } from '@saulx/utils'

export function setupFunctionHandlers(server, configDb: DbClient) {
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
      async fn(_based, schemas = []) {
        await Promise.all(
          schemas.map((schema) =>
            configDb.upsert('schema', {
              name: schema.db,
              schema: schema.schema,
              status: 'pending',
            }),
          ),
        )
        await new Promise<void>((resolve) =>
          configDb.query('schema').subscribe((res) => {
            for (const schema of res) {
              if (schema.status === 'pending') {
                return
              }
            }
            resolve()
          }),
        )
      },
    },
    'db:schema': {
      type: 'query',
      async fn(_based, name = 'default', update) {
        return configDb.query('schema', { name }).subscribe((res) => {
          update(res.toObject())
        })
      },
    },
    'based:login': {
      type: 'function',
      async fn(_based, { email, code }) {
        return configDb.upsert('login', { email, code, status: 'pending' })
      },
    },
  })

  configDb.query('function').subscribe(async (data) => {
    const specs: BasedFunctionConfigs = {}
    await Promise.all(
      data.map(async (item) => {
        const { contents, name, config } = item
        const fn = await import(`data:text/javascript,${contents}`)
        specs[name] = {
          type: 'function',
          fn: fn.default,
          ...fn,
          ...config,
        }
      }),
    )
    server.functions.add(specs)
  })
}
