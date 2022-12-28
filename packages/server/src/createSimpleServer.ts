import { AuthConfig } from './auth'
import {
  BasedFunction,
  BasedFunctionSpec,
  BasedObservableFunction,
  BasedObservableFunctionSpec,
} from './functions'
import { BasedServer, ServerOptions } from './server'

export type SimpleServerOptions = {
  port?: number
  key?: string
  cert?: string
  auth?: AuthConfig
  functions?: {
    [key: string]:
      | BasedFunction
      | (Partial<BasedFunctionSpec> & { function: BasedFunction })
  }
  observables?: {
    [key: string]:
      | BasedObservableFunction
      | (Partial<BasedObservableFunctionSpec> & {
          function: BasedObservableFunction
        })
  }
}

export async function createSimpleServer(
  props: SimpleServerOptions,
  sharedSocket?: boolean
): Promise<BasedServer> {
  const { functions, observables } = props

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
          path: `/${name}`,
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
          path: `/${name}`,
          name,
          observable: false,
          checksum: 1,
          maxPayloadSize: 5e3,
          rateLimitTokens: 1,
        }
      }
    }
  }

  for (const name in observables) {
    if (observables[name]) {
      const fn = observables[name]

      if (isObsFunctionSpec(fn)) {
        functionStore[name] = {
          checksum: 1,
          observable: true,
          function: fn.function,
          path: `/${name}`,
          name,
          maxPayloadSize: 500,
          rateLimitTokens: 5,
          ...fn,
        }
      } else {
        functionStore[name] = {
          checksum: 1,
          observable: true,
          function: fn,
          name,
          path: `/${name}`,
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
    functions: {
      memCacheTimeout: 3e3,
      idleTimeout: 1e3,
      uninstall: async () => {
        return true
      },
      install: async ({ name }) => {
        if (functionStore[name]) {
          return functionStore[name]
        } else {
          return false
        }
      },
      route: ({ path, name }) => {
        if (path) {
          for (const name in functionStore) {
            if (functionStore[name].path === path) {
              return functionStore[name]
            }
          }
        }
        if (functionStore[name]) {
          return functionStore[name]
        }
        return false
      },
    },
  }

  console.info('Server starting with the following functions:')
  for (const name in functionStore) {
    console.info({
      name: functionStore[name].name,
      path: functionStore[name].path,
      observable: functionStore[name].observable,
    })
  }

  const basedServer = new BasedServer(properProps)
  return props.port ? basedServer.start(props.port, sharedSocket) : basedServer
}

// function simpleFuncToNormal(
//   fn: (payload: any, ctx: Context) => any | Partial<BasedFunctionSpec>
// ): BasedFunctionSpec {}

export function isFunctionSpec(
  fn: BasedFunction | Partial<BasedFunctionSpec>
): fn is Partial<BasedFunctionSpec> {
  return 'function' in fn || false
}

export function isObsFunctionSpec(
  fn: BasedObservableFunction | Partial<BasedObservableFunctionSpec>
): fn is Partial<BasedObservableFunctionSpec> {
  return 'function' in fn || false
}
