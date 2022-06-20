import test from 'ava'
import createServer from '@based/server'
import based from '../src'
import { start } from '@saulx/selva-server'
import { wait, deepCopy } from '@saulx/utils'

let db

test.before(async () => {
  const selvaServer = await start({
    port: 9299,
  })
  db = selvaServer.selvaClient
  await selvaServer.selvaClient.updateSchema({
    types: {
      thing: {
        fields: {
          name: { type: 'string' },
          nested: {
            type: 'object',
            properties: {
              something: { type: 'string' },
            },
          },
        },
      },
    },
  })
})

test.after(async () => {
  await db.destroy()
})

test.serial('call functions from db schema', async (t) => {
  // maybe make a small selva helper as well (can go into a function)
  const store = {
    schematimes: {
      observable: false,
      function: async ({ based }) => {
        const schema = await based.schema()

        return {
          schema,
        }
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
        subscribeFunctions: async (cb: (err: Error, d?: any) => void) => {
          cb(new Error('hello'))
          return () => undefined
        },
        idleTimeout: 1e3,
        clear: async (server, name) => {
          clears.push(name)
        },
        getInitial: async (server, name) => {
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
  const bla = await client.call('schematimes')

  await wait(1e3)

  t.true('schema' in bla)

  await server.destroy()
  client.disconnect()
})

test.serial('call functions from db', async (t) => {
  // maybe make a small selva helper as well (can go into a function)
  const store = {
    hello: {
      observable: false,
      function: async () => {
        return {
          hello: 'world',
        }
      },
    },
    schematimes: {
      observable: false,
      function: async ({ based }) => {
        const schema = await based.schema()

        return {
          schema,
        }
      },
    },
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
        subscribeFunctions: async (cb: (err: Error, d?: any) => void) => {
          cb(new Error('hello'))
          return () => undefined
        },
        idleTimeout: 1e3,
        clear: async (server, name) => {
          clears.push(name)
        },
        getInitial: async (server, name) => {
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
  const bla = await client.call('hello')
  t.deepEqual(bla, {
    hello: 'world',
  })
  const res = []
  const close = await client.observe('obs', (d) => {
    res.push(d)
  })
  await wait(750)
  close()
  t.is(res.length, 2)
  const x = await client.call('hello')
  t.deepEqual(x, {
    hello: 'world',
  })
  await wait(1000)
  t.deepEqual(clears, ['obs'])
  await wait(1000)
  t.deepEqual(clears, ['obs', 'hello'])
  // cleared
  // make it nice
  // const x = await client.call('hello')
  await server.destroy()
  client.disconnect()
})

test.serial('update active observables', async (t) => {
  // maybe make a small selva helper as well (can go into a function)

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

  // const updateFn

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
        subscribeFunctions: async (cb: (err: Error, d?: any) => void) => {
          cb(new Error('hello'))
          return () => undefined
        },
        idleTimeout: 1e3,
        clear: async (server, name) => {
          clears.push(name)
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

  const res = []
  await client.observe('obs', (d) => {
    res.push(d)
  })

  await wait(2e3)

  store.obs.function = async ({ update }) => {
    let cnt = 0
    const int = setInterval(() => {
      update({ cnt: ++cnt, flapperdrol: true })
    }, 500)
    return () => clearInterval(int)
  }

  server.restartSubscription('obs')

  await wait(1e3)
  t.true(res[res.length - 1].flapperdrol)

  const client2 = based({
    url: async () => {
      return 'ws://localhost:9101'
    },
  })

  const a = []
  const b = []

  await client.observe('nonShared', (d) => {
    a.push(deepCopy(d))
  })

  await client2.observe('nonShared', (d) => {
    b.push(deepCopy(d))
  })

  await wait(1e3)

  t.is(initCnt, 2)

  store.nonShared.function = async ({ update }) => {
    const myInit = ++initCnt
    let cnt = 0
    const int = setInterval(() => {
      update({ cnt: ++cnt, myInit, flippie: true })
    }, 500)
    return () => clearInterval(int)
  }

  server.restartSubscription('nonShared')

  await wait(1e3)

  t.is(initCnt, 4)

  t.true(a[a.length - 1].flippie)
  t.true(b[b.length - 1].flippie)
  t.not(b[b.length - 1].myInit, a[a.length - 1].myInit)

  await server.destroy()
  client.disconnect()
})

// make clearing of secrets a thing later - implement better in hub
test.serial('get secrets', async (t) => {
  let clearCnt = 0

  const server = await createServer({
    port: 9101,
    db: {
      host: 'localhost',
      port: 9299,
    },
    // ok seperate db - with schema
    // you can get functions from your org?
    config: {
      functions: {
        hello: {
          observable: false,
          function: async ({ based }) => {
            return based.secret('snurf')
          },
        },
      },

      secretsConfig: {
        idleTimeout: 1e3,
        getInitial: async () => {
          return 'flappiepants'
        },
        clear: async () => {
          clearCnt++
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9101'
    },
  })

  const x = await client.call('hello')

  // @ts-ignore
  t.is(x, 'flappiepants')

  await wait(3e3)

  t.is(clearCnt, 1)
  t.is(Object.keys(server.config.secrets).length, 0)

  await server.destroy()
  client.disconnect()
  t.pass()
})
