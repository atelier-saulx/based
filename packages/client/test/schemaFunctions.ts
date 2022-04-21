import test from 'ava'
import createServer from '@based/server'
import based from '../src'

test.serial(
  'subscribe schema - get function names and get updates when functions get added/removed',
  async (t) => {
    let initCnt = 0

    const store = {
      obs: {
        observable: true,
        shared: true,
        function: async ({ update }) => {
          let cnt = 0
          const int = setInterval(() => {
            update({ cnt: ++cnt })
          }, 500)
          return () => clearInterval(int)
        },
      },
      nonShared: {
        observable: true,
        shared: false,
        function: async ({ update }) => {
          const myInit = ++initCnt
          let cnt = 0
          const int = setInterval(() => {
            update({ cnt: ++cnt, myInit })
          }, 500)
          return () => clearInterval(int)
        },
      },
    }

    const clears = []
    const server = await createServer({
      port: 9101,
      db: {
        host: 'localhost',
        port: 9299,
      },
      // ok seperate db - with schema
      // you can get functions from your org?
      config: {
        functionConfig: {
          idleTimeout: 1e3,
          clear: async (server, name) => {
            clears.push(name)
          },

          subscribeFunctions: async (cb: (err: Error, d?: any) => void) => {
            cb(new Error('hello'))
            return () => undefined
          },

          getInitial: async (server, name) => {
            // update it
            if (store[name]) {
              return store[name]
            } else {
              return null
            }
          },
        },
      },
    })

    const client = based({
      url: async () => {
        return 'ws://localhost:9101'
      },
    })

    await server.destroy()
    client.disconnect()

    t.pass()
  }
)
