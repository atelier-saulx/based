// env:
// jobs
// config db
// default db
// *events hub?

import { BasedDb } from '@based/db'
import { BasedFunctionConfigs } from '@based/functions'
import { BasedServer } from '@based/server'
import { readStream } from '@saulx/utils'
import { join } from 'path'

type Opts = {
  port: number
  path: string
}

const start = async ({ port, path }: Opts) => {
  const configDb = new BasedDb({
    path: join(path, 'config'),
  })
  const defaultDb = new BasedDb({
    path: join(path, 'default'),
  })
  const metricsDb = new BasedDb({
    path: join(path, 'metrics'),
  })

  await Promise.all([configDb.start(), defaultDb.start(), metricsDb.start()])

  await configDb.setSchema({
    types: {
      schema: {
        name: 'string',
        schema: 'json',
        createdAt: {
          type: 'timestamp',
          on: 'create',
        },
        updatedAt: {
          type: 'timestamp',
          on: 'create',
        },
      },
      function: {
        name: 'alias',
        contents: 'string',
        config: 'json',
        createdAt: {
          type: 'timestamp',
          on: 'create',
        },
        updatedAt: {
          type: 'timestamp',
          on: 'create',
        },
      },
    },
  })

  const server = new BasedServer({
    port,
    functions: {
      configs: {
        'based:set-function': {
          type: 'stream',
          async fn(based, { stream, payload }) {
            const contents = await readStream(stream)
            await configDb.upsert('function', {
              name: payload.config.name,
              contents: contents.toString(),
              config: payload.config,
            })
            console.log('function done!')
          },
        },
      },
    },
  })

  configDb.query('function').subscribe(async (data) => {
    const specs: BasedFunctionConfigs = {}
    for (const item of data) {
      const { contents, name } = item
      const fn = await import(`data:text/javascript,${contents}`)

      specs[name] = {
        type: 'function',
        name: name,
        fn: fn.default,
      }
    }
    server.functions.add(specs)
  })

  await server.start()

  return {
    services: [server, configDb, defaultDb, metricsDb],
  }
}

export default start

// const hub = await createHub({
//   port: 8080,
//   // gets called the first time an enabled route gets called
//   async loadRoute({ path }) {

//   },
//   async loadDbClient({ name }) {
//     return new DbClient(config)
//   },
// })

// watcher.on('function', () => {
//   hub.enableRoute()
// })
