import { AuthConfig } from './auth'
import { BasedFunctionSpec, BasedObservableFunctionSpec } from './functions'
import { BasedQueryFunction, BasedFunction } from '@based/functions'
import picocolors from 'picocolors'
import { BasedServer, ServerOptions } from './server'

const whiteSpace = (nr: number) => {
  let str = ''
  for (let i = 0; i < nr; i++) {
    str += ' '
  }
  return str
}

export type SimpleServerOptions = {
  port?: number
  key?: string
  disableRest?: boolean
  cert?: string
  auth?: AuthConfig
  install?: (opts: {
    server: BasedServer
    name: string
    function?: BasedFunctionSpec | BasedObservableFunctionSpec
  }) => Promise<false | BasedObservableFunctionSpec | BasedFunctionSpec>
  uninstall?: (opts: {
    server: BasedServer
    name: string
    function: BasedObservableFunctionSpec | BasedFunctionSpec
  }) => Promise<boolean>
  functions?: {
    [key: string]:
      | BasedFunction
      | (Partial<BasedFunctionSpec> & { function: BasedFunction })
  }
  queryFunctions?: {
    [key: string]:
      | BasedQueryFunction
      | (Partial<BasedObservableFunctionSpec> & {
          function: BasedQueryFunction
        })
  }
}

export async function createSimpleServer(
  props: SimpleServerOptions,
  sharedSocket?: boolean
): Promise<BasedServer> {
  const { functions, queryFunctions } = props

  const functionStore: {
    [key: string]:
      | (BasedFunctionSpec & {
          maxPayloadSize: number
          rateLimitTokens: number
        })
      | (BasedObservableFunctionSpec & {
          maxPayloadSize: number
          rateLimitTokens: number
        })
  } = {}

  for (const name in functions) {
    if (functions[name]) {
      const fn = functions[name]
      if (isFunctionSpec(fn)) {
        functionStore[name] = {
          function: fn.function,
          name,
          observable: false,
          checksum: 1,
          maxPayloadSize: 5e3,
          rateLimitTokens: 1,
          ...fn,
        }
      } else {
        functionStore[name] = {
          function: fn,
          name,
          observable: false,
          checksum: 1,
          maxPayloadSize: 5e3,
          rateLimitTokens: 1,
        }
      }
    }
  }

  for (const name in queryFunctions) {
    if (queryFunctions[name]) {
      const fn = queryFunctions[name]

      if (isObsFunctionSpec(fn)) {
        functionStore[name] = {
          checksum: 1,
          query: true,
          function: fn.function,
          name,
          maxPayloadSize: 500,
          rateLimitTokens: 5,
          ...fn,
        }
      } else {
        functionStore[name] = {
          checksum: 1,
          query: true,
          function: fn,
          name,
          maxPayloadSize: 500,
          rateLimitTokens: 5,
        }
      }
    }
  }

  const properProps: ServerOptions = {
    port: props.port,
    auth: props.auth,
    cert: props.cert,
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
    const obs = functionStore[name].query ? '[query]' : ''
    const pub = functionStore[name].public ? 'public' : 'private'
    console.info(
      '      ',
      picocolors.white(name),
      whiteSpace(longestName + 2 - name.length),
      picocolors.gray(pub),
      whiteSpace(8 - pub.length),
      picocolors.green(obs),
      whiteSpace(14 - obs.length),
      functionStore[name].path || ''
    )
  }

  const basedServer = new BasedServer(properProps)
  return props.port ? basedServer.start(props.port, sharedSocket) : basedServer
}

export function isFunctionSpec(
  fn: BasedFunction | Partial<BasedFunctionSpec>
): fn is Partial<BasedFunctionSpec> {
  return 'function' in fn || false
}

export function isObsFunctionSpec(
  fn: BasedQueryFunction | Partial<BasedObservableFunctionSpec>
): fn is Partial<BasedObservableFunctionSpec> {
  return 'function' in fn || false
}
