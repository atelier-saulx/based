import { DbClient } from '@based/db'
import { BasedFunctionConfigs } from '@based/functions'
import { BasedServer } from '@based/server'
import { createEvent } from './event.js'
import { addStats } from './addStats.js'
import { Module } from 'node:module'
import { crc32c } from '@based/hash'

function requireFn(code, filename) {
  const m = new Module(filename)
  // @ts-ignore
  m._compile(code, filename)
  return m.exports
}

// stat wrapper
export const initDynamicFunctions = (
  server: BasedServer,
  configDb: DbClient,
  statsDb: DbClient,
  fnIds: Record<string, { statsId: number }>,
) => {
  let updatedJobs = {}
  let jobs = {}

  configDb.query('function').subscribe(async (data) => {
    const specs: BasedFunctionConfigs = {}
    await Promise.all(
      data.map(async (item) => {
        const { code, name, config } = item
        const checksum = crc32c(code)
        if (!fnIds[name]) {
          fnIds[name] = { statsId: 0 }
        }

        const statsId = (fnIds[name].statsId = await statsDb.upsert(
          'function',
          {
            name,
            checksum,
          },
        ))

        try {
          const fn = requireFn(code, name)
          // get the globalFn things and attach to function store
          const { default: fnDefault, js, css, ...rest } = fn
          if (config.type === 'authorize') {
            console.warn('skipping authorize', name, config)
            return
          }

          if (config.type === 'app') {
            specs[name] = addStats(
              {
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
              },
              statsDb,
            )
          } else if (config.type === 'job') {
            const currentJob = jobs[name]
            if (!currentJob) {
              updatedJobs[name] = fnDefault(server.client)
              // updatedJobs[name].checksum = checksum
            } else if (currentJob.checksum === checksum) {
              updatedJobs[name] = fnDefault(server.client)
              // updatedJobs[name].checksum = checksum
              currentJob()
            } else {
              updatedJobs[name] = currentJob
            }
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
    jobs = updatedJobs
  })
}
