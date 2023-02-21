import {
  BasedFunctionSpec,
  BasedQueryFunctionSpec,
  BasedStreamFunctionSpec,
  BasedSpec,
  isSpec,
  isQueryFunctionSpec,
  isStreamFunctionSpec,
  BasedChannelFunctionSpec,
  isChannelFunctionSpec,
} from './functions'
import {
  BasedQueryFunction,
  BasedFunction,
  BasedChannelFunction,
} from '@based/functions'
import picocolors from 'picocolors'
import { BasedServer, ServerOptions } from './server'
import { padLeft } from '@saulx/utils'

export type SimpleServerOptions = {
  install?: (opts: {
    server: BasedServer
    name: string
    function?: BasedSpec
  }) => Promise<null | BasedSpec>
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
  channels?: {
    [key: string]: BasedChannelFunction | Partial<BasedChannelFunctionSpec>
  }
  /* Prevents printing server logs */
  silent?: boolean
  /* Default time to keep channels and queries open for a while after all subscribers are gone */
  closeAfterIdleTime?: {
    channel: number
    query: number
  }
  /* Time to uninstall functions defaults to endless */
  uninstallAfterIdleTime?: number
} & Omit<ServerOptions, 'functions'>

export async function createSimpleServer(
  props: SimpleServerOptions,
  sharedSocket?: boolean
): Promise<BasedServer> {
  const { functions, queryFunctions, channels } = props
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

  for (const name in channels) {
    if (channels[name]) {
      const fn = channels[name]
      if (isSpec(fn)) {
        functionStore[name] = {
          checksum: 1,
          channel: true,
          function: fn.function,
          publish:
            fn.publish ||
            ((based, payload, msg, id) => {
              console.warn(
                '     ↓ Publish to channel (no handler defined)',
                name,
                payload,
                msg,
                id
              )
            }),
          name,
          maxPayloadSize: 500,
          rateLimitTokens: 1,
          ...fn,
        }
      } else if (typeof fn === 'function') {
        functionStore[name] = {
          checksum: 1,
          channel: true,
          publish: (based, payload, msg, id) => {
            console.warn(
              '     ↓ Publish to channel (no handler defined)',
              name,
              payload,
              msg,
              id
            )
          },
          function: fn,
          name,
          maxPayloadSize: 500,
          rateLimitTokens: 1,
        }
      } else {
        console.error(name, fn, 'Is not a channel function!')
      }
    }
  }

  const properProps: ServerOptions = {
    ...props,
    functions: {
      closeAfterIdleTime: props.closeAfterIdleTime,
      uninstallAfterIdleTime: props.uninstallAfterIdleTime || -1, // never needs to uninstall
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
            return null
          }
        }),
      route: ({ path, name }) => {
        let rootFn
        if (path) {
          for (const name in functionStore) {
            const fnPath = functionStore[name].path
            if (fnPath === path) {
              return functionStore[name]
            }
            if (!rootFn && fnPath === '/') {
              rootFn = functionStore[name]
            }
          }
        }
        return functionStore[name] || rootFn || null
      },
    },
  }

  if (!props.silent) {
    console.info(
      '   ',
      picocolors.white('Based-server'),
      `starting with functions`
    )
  }

  let longestName = 0

  for (const name in functionStore) {
    if (name.length > longestName) {
      longestName = name.length
    }
  }

  for (const name in functionStore) {
    const obs = isChannelFunctionSpec(functionStore[name])
      ? '[channel]'
      : isQueryFunctionSpec(functionStore[name])
      ? '[query]'
      : isStreamFunctionSpec(functionStore[name])
      ? '[stream]'
      : ''
    const pub = functionStore[name].public ? 'public' : 'private'
    if (!props.silent) {
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
  }

  const basedServer = new BasedServer(properProps)
  return props.port
    ? basedServer.start(props.port, sharedSocket, props.silent)
    : basedServer
}
