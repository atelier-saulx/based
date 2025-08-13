import { DbClient } from '@based/db'
import {
  Authorize,
  BasedAppFunction,
  BasedFunctionConfig,
  BasedFunctionConfigs,
  BasedJobFunction,
  VerifyAuthState,
} from '@based/functions'
import { BasedServer } from '@based/server'
import { createEvent } from './event.js'
import { addStats } from './addStats.js'
import { Module } from 'node:module'
import { crc32c, hash } from '@based/hash'

const requireFn = (code: string, id: string) => {
  const m = new Module(id)
  // @ts-ignore
  m._compile(code, id)
  return m.exports
}

let warned
const setAuthorize = (
  server: BasedServer,
  fnDefault: Authorize,
  verifyAuthState: VerifyAuthState,
) => {
  server.auth.updateConfig({
    async authorize(based, ctx, name, payload) {
      await based.renewAuthState(ctx)
      if (!ctx.session) {
        return
      }
      const { authState } = ctx.session
      if (authState.type) {
        if (authState.type === 'based' || authState.type === 'serviceAccount') {
          return Boolean(authState.token)
        }
      }
      return fnDefault(based, ctx, name, payload)
    },
    async verifyAuthState(based, ctx, authState) {
      if (!ctx.session || !authState) {
        return {}
      }

      if (authState.type === 'based' || authState.type === 'serviceAccount') {
        if (!warned) {
          console.warn(
            'WARNING: based authState always verified, not suitable for online env',
          )
          warned = true
        }

        return authState
      }

      if (verifyAuthState) {
        return verifyAuthState(based, ctx, authState)
      }

      if (authState.token !== ctx.session.authState.token) {
        return authState
      }

      return true
    },
  })
}

const setAppFunction = (
  fnDefault: BasedAppFunction,
  config: any,
  statsId,
  checksum,
  statsDb,
) => {
  return addStats(
    {
      fn: (based, _payload, ctx) => {
        return fnDefault(
          based,
          {
            css: {
              url: config.css,
              text: null,
            },
            js: {
              url: config.js,
              text: null,
            },
            favicon: {
              get url() {
                console.log('TODO FAVICON')
                return ''
              },
              content: null,
              path: null,
            },
          },
          ctx,
        )
      },
      ...config,
      statsId,
      type: 'function',
      checksum,
    },
    statsDb,
  )
}

const setJobFunction = (
  server: BasedServer,
  fnDefault: BasedJobFunction,
  jobs: Record<string, any>,
  name: string,
  checksum: number | string,
) => {
  const currentJob = jobs[name]
  if (!currentJob) {
    return Object.assign(fnDefault(server.client), { checksum })
  }
  if (currentJob.checksum !== checksum) {
    currentJob()
    return Object.assign(fnDefault(server.client), { checksum })
  }

  return currentJob
}

// stat wrapper
export const initDynamicFunctions = (
  server: BasedServer,
  configDb: DbClient,
  statsDb: DbClient,
  fnIds: Record<string, { statsId: number }>,
) => {
  let jobs = {}

  configDb
    .query('function')
    .include('code', 'name', 'config')
    .subscribe(async (data) => {
      const specs: BasedFunctionConfigs = {}
      const updatedJobs = {}

      await Promise.all(
        data.map(async (item) => {
          const { id, code, name, config } = item
          const checksum =
            config.type === 'app'
              ? crc32c(code + JSON.stringify(config))
              : crc32c(code)

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
            const fn = requireFn(code, `${name}-${checksum}`)
            // get the globalFn things and attach to function store
            const {
              default: fnDefault,
              verifyAuthState,
              publisher,
              subscriber,
            } = fn
            if (config.type === 'authorize') {
              setAuthorize(server, fnDefault, verifyAuthState)
            } else if (config.type === 'app') {
              specs[name] = setAppFunction(
                fnDefault,
                config,
                statsId,
                checksum,
                statsDb,
              )
            } else if (config.type === 'job') {
              updatedJobs[name] = setJobFunction(
                server,
                fnDefault,
                jobs,
                name,
                checksum,
              )
            } else {
              specs[name] = addStats(
                {
                  type: 'function',
                  fn: fnDefault,
                  publisher,
                  subscriber,
                  ...config,
                  statsId,
                  checksum,
                },
                statsDb,
              )
            }

            const now = Date.now()
            console.log(name, { now })
            configDb.update('function', id, { loadedAt: now, updatedAt: now })
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
