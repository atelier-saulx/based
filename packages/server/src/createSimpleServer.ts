import { AuthConfig } from './auth'
import {
  BasedFunctionSpec,
  BasedQueryFunctionSpec,
  BasedStreamFunctionSpec,
  BasedSpec,
  isSpec,
  isQueryFunctionSpec,
  isStreamFunctionSpec,
} from './functions'
import {
  BasedQueryFunction,
  BasedFunction,
  Context,
  Session,
} from '@based/functions'
import picocolors from 'picocolors'
import { BasedServer, ServerOptions } from './server'
import { padLeft } from '@saulx/utils'

export type SimpleServerOptions = {
  port?: number
  key?: string
  disableRest?: boolean
  cert?: string
  auth?: AuthConfig
  ws?: {
    open: (client: Context<Session>) => void
    close: (client: Context<Session>) => void
  }
  install?: (opts: {
    server: BasedServer
    name: string
    function?: BasedSpec
  }) => Promise<false | BasedSpec>
  uninstall?: (opts: {
    server: BasedServer
    name: string
    function: BasedSpec
  }) => Promise<boolean>
  functions?: {
    [key: string]:
      | BasedFunction
      | Partial<BasedFunctionSpec | BasedStreamFunctionSpec>
  }
  queryFunctions?: {
    [key: string]: BasedQueryFunction | Partial<BasedQueryFunctionSpec>
  }
}

export async function createSimpleServer(
  props: SimpleServerOptions,
  sharedSocket?: boolean
): Promise<BasedServer> {
  const { functions, queryFunctions } = props

  const functionStore: {
    [key: string]: BasedSpec & {
      maxPayloadSize: number
      rateLimitTokens: number
    }
  } = {}

  for (const name in functions) {
    if (functions[name]) {
      const fn = functions[name]
      if (isSpec(fn)) {
        functionStore[name] = {
          function: fn.function,
          name,
          checksum: 1,
          maxPayloadSize: isStreamFunctionSpec(fn) ? 200e6 : 5e4,
          rateLimitTokens: 10,
          ...fn,
        }
      } else if (typeof fn === 'function') {
        functionStore[name] = {
          function: fn,
          name,
          checksum: 1,
          maxPayloadSize: 5e4,
          rateLimitTokens: 1,
        }
      } else {
        console.error(name, fn, 'Is not a function!')
      }
    }
  }

  for (const name in queryFunctions) {
    if (queryFunctions[name]) {
      const fn = queryFunctions[name]
      if (isSpec(fn)) {
        functionStore[name] = {
          checksum: 1,
          query: true,
          function: fn.function,
          name,
          maxPayloadSize: 5000,
          rateLimitTokens: 1,
          ...fn,
        }
      } else if (typeof fn === 'function') {
        functionStore[name] = {
          checksum: 1,
          query: true,
          function: fn,
          name,
          maxPayloadSize: 5000,
          rateLimitTokens: 1,
        }
      } else {
        console.error(name, fn, 'Is not a query function!')
      }
    }
  }

  const properProps: ServerOptions = {
    port: props.port,
    auth: props.auth,
    cert: props.cert,
    ws: props.ws,
    disableRest: props.disableRest,
    key: props.key,
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 1e3, // never needs to uninstall
      uninstall:
        props.uninstall ||
        (async () => {
          return true
        }),
      install:
        props.install ||
        (async ({ name }) => {
          if (functionStore[name]) {
            return functionStore[name]
          } else {
            return false
          }
        }),
      route: ({ path, name }) => {
        if (path) {
          for (const name in functionStore) {
            if (functionStore[name].path === path) {
              return functionStore[name]
            }
          }
          if (!name && functionStore[path]) {
            return functionStore[path]
          }
        }
        if (functionStore[name]) {
          return functionStore[name]
        }
        return false
      },
    },
  }

  console.info(
    '   ',
    picocolors.white('Based-server'),
    `starting with functions`
  )

  let longestName = 0

  for (const name in functionStore) {
    if (name.length > longestName) {
      longestName = name.length
    }
  }

  for (const name in functionStore) {
    const obs = isQueryFunctionSpec(functionStore[name])
      ? '[query]'
      : isStreamFunctionSpec(functionStore[name])
      ? '[stream]'
      : ''
    const pub = functionStore[name].public ? 'public' : 'private'
    console.info(
      '      ',
      picocolors.white(name),
      padLeft('', longestName + 2 - name.length, ' '),
      picocolors.gray(pub),
      padLeft('', 8 - pub.length, ' '),
      picocolors.green(obs),
      padLeft('', 14 - obs.length, ' '),
      functionStore[name].path || ''
    )
  }

  const basedServer = new BasedServer(properProps)
  return props.port ? basedServer.start(props.port, sharedSocket) : basedServer
}
