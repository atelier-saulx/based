import { DbClient } from '@based/db'
import { BasedFunctionConfigs } from '@based/functions'
import { BasedServer } from '@based/server'
import { createEvent } from './event.js'
import { addStats } from './addStats.js'
import { Worker } from 'node:worker_threads'

// stat wrapper

export const initDynamicFunctions = (
  server: BasedServer,
  configDb: DbClient,
  statsDb: DbClient,
  fnIds: Record<string, { statsId: number }>,
) => {
  configDb.query('function').subscribe(async (data) => {
    const specs: BasedFunctionConfigs = {}
    await Promise.all(
      data.map(async (item) => {
        const { code, name, config } = item

        if (!fnIds[name]) {
          fnIds[name] = { statsId: 0 }
        }

        const statsId = (fnIds[name].statsId = await statsDb.upsert(
          'function',
          {
            name,
            checksum: config.checksum,
          },
        ))

        try {
          const fn = await import(
            `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
          )

          // get the globalFn things and attach to function store
          const { default: fnDefault, js, css, ...rest } = fn
          if (config.type === 'authorize') {
            console.warn('skipping authorize', name, config)
            return
          }

          if (config.type === 'app') {
            specs[name] = {
              fn: (based, _payload, ctx) => {
                return fnDefault(
                  based,
                  {
                    css: {
                      url: config.css,
                    },
                    js: {
                      url: config.js,
                    },
                    favicon: {
                      get url() {
                        console.log('TODO FAVICON')
                        return ''
                      },
                    },
                  },
                  ctx,
                )
              },
              ...rest,
              ...config,
              statsId,
              type: 'function',
            }
          } else if (config.type === 'job') {
            // TODO: This should be turned into a worker with eval.
            // Problem is having globals._FnGlobals in it
            // also passing based into it
            fnDefault()
          } else {
            specs[name] = addStats(
              {
                type: 'function',
                fn: fnDefault,
                ...rest,
                ...config,
                statsId,
              },
              statsDb,
            )
          }
        } catch (err) {
          console.log('error', err)
          createEvent(statsDb, statsId, err.message, 'init', 'error')
        }
      }),
    )
    server.functions.add(specs)
  })
}
