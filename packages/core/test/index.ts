import test from 'ava'
import { BasedCoreClient } from '../src/index'
import createServer, { BasedServer } from '@based/server'

// import { wait } from '@saulx/utils'
// import basedCoreClient from '../src'
// // import { start } from '@saulx/selva-server'

test.serial('connection', async (t) => {
  const coreClient = new BasedCoreClient()

  const store = {
    hello: async ({ payload }) => {
      console.info(payload)
      return 'hello this is a repsonse...'
    },
  }

  /*
    // functions: {},
    // authorize:
    // validateToken + renewToken
    // db: {}

    // on reconenct check checksums - if not the same then resend
    // does mean we set the binary on send out
  */

  const server = createServer({
    port: 9910,
    functions: {
      memCache: 1e3,
      idleTimeout: 1e3,
      clear: async (server: BasedServer, name) => {
        // clears.push(name)
        console.info(server, name)
      },
      register: async (server, name) => {
        console.info(server, name)
        if (store[name]) {
          return store[name]
        } else {
          return null
        }
      },
      log: (
        type: 'error' | 'warn' | 'info' | 'log',
        name: string,
        message: string,
        callstack: string[]
      ) => {
        // need to read sourcemaps for this
        // maybe also call stack etc
        // --enable-source-maps (when running the node process)
      },
    },
  })

  // @ts-ignore handles removing prev / update observables in place - same for worker (which is the default)
  server.functions.update({
    name,
    observable,
    code,
    version,
    worker,
    idleTimeout,
  })
  // @ts-ignore handles removing fn and current instanes
  server.functions.remove({ name, version })
  // @ts-ignore (means a fn is idle for a while)
  server.functions.clear = (): boolean => {
    // if false then it will not be removed (e.g. for native fns)
  }
  // @ts-ignore (means a new fn is requested)
  server.functions.register = () => {}
  // @ts-ignore
  server.functions.idleTimeout = 1e3 // 0 means persist

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  coreClient.once('connection', (isConnected) => {
    console.info(isConnected)
  })

  coreClient.once('schema', (schema) => {
    console.info(schema)
  })

  t.pass()
})
