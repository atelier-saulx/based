import anyTest, { TestInterface } from 'ava'
import createServer from '@based/server'
import { start } from '@saulx/selva-server'
import based from '@based/client'
import { SelvaClient } from '@saulx/selva'
import { wait } from '@saulx/utils'

const test = anyTest as TestInterface<{ db: SelvaClient }>

test.before(async (t) => {
  const selvaServer = await start({
    port: 9401,
  })
  t.context.db = selvaServer.selvaClient
  await t.context.db.updateSchema({
    types: {
      thing: {
        prefix: 'th',
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

test.after(async (t) => {
  await t.context.db.destroy()
})

test.serial(
  'authorize pass and defaultAuthorize pass should pass',
  async (t) => {
    const server = await createServer({
      port: 9333,
      db: {
        host: 'localhost',
        port: 9401,
      },
      config: {
        authorize: async () => {
          return true
        },
        defaultAuthorize: async () => {
          return true
        },
      },
    })
    const client = based({
      url: async () => {
        return 'ws://localhost:9333'
      },
    })
    t.teardown(async () => {
      await server.destroy()
      client.disconnect()
    })

    await t.notThrowsAsync(async () => {
      const result = await client.get({
        $id: 'root',
        id: true,
      })
      t.is(result.id, 'root')
    })
  }
)

test.serial(
  'authorize fail and defaultAuthorize pass should pass',
  async (t) => {
    const server = await createServer({
      port: 9333,
      db: {
        host: 'localhost',
        port: 9401,
      },
      config: {
        authorize: async () => {
          return false
        },
        defaultAuthorize: async () => {
          return true
        },
      },
    })
    const client = based({
      url: async () => {
        return 'ws://localhost:9333'
      },
    })
    t.teardown(async () => {
      await server.destroy()
      client.disconnect()
    })

    await t.notThrowsAsync(async () => {
      const result = await client.get({
        $id: 'root',
        id: true,
      })
      t.is(result.id, 'root')
    })
  }
)

test.serial(
  'authorize pass and defaultAuthorize fail should pass',
  async (t) => {
    const server = await createServer({
      port: 9333,
      db: {
        host: 'localhost',
        port: 9401,
      },
      config: {
        authorize: async () => {
          return true
        },
        defaultAuthorize: async () => {
          return false
        },
      },
    })
    const client = based({
      url: async () => {
        return 'ws://localhost:9333'
      },
    })
    t.teardown(async () => {
      await server.destroy()
      client.disconnect()
    })

    await t.notThrowsAsync(async () => {
      const result = await client.get({
        $id: 'root',
        id: true,
      })
      t.is(result.id, 'root')
    })
  }
)

test.serial(
  'authorize fail and defaultAuthorize fail should fail',
  async (t) => {
    const server = await createServer({
      port: 9333,
      db: {
        host: 'localhost',
        port: 9401,
      },
      config: {
        authorize: async () => {
          return false
        },
        defaultAuthorize: async () => {
          return false
        },
      },
    })
    const client = based({
      url: async () => {
        return 'ws://localhost:9333'
      },
    })
    t.teardown(async () => {
      await server.destroy()
      client.disconnect()
    })

    await t.throwsAsync(async () => {
      await client.get({
        $id: 'root',
        id: true,
      })
    })
  }
)

test.serial(
  'authorize missing and defaultAuthorize pass should pass',
  async (t) => {
    const server = await createServer({
      port: 9333,
      db: {
        host: 'localhost',
        port: 9401,
      },
      config: {
        defaultAuthorize: async () => {
          return true
        },
      },
    })
    const client = based({
      url: async () => {
        return 'ws://localhost:9333'
      },
    })
    t.teardown(async () => {
      await server.destroy()
      client.disconnect()
    })

    await t.notThrowsAsync(async () => {
      const result = await client.get({
        $id: 'root',
        id: true,
      })
      t.is(result.id, 'root')
    })
  }
)

test.serial(
  'authorize missing and defaultAuthorize fail should fail',
  async (t) => {
    const server = await createServer({
      port: 9333,
      db: {
        host: 'localhost',
        port: 9401,
      },
      config: {
        defaultAuthorize: async () => {
          return false
        },
      },
    })
    const client = based({
      url: async () => {
        return 'ws://localhost:9333'
      },
    })
    t.teardown(async () => {
      await server.destroy()
      client.disconnect()
    })

    await t.throwsAsync(async () => {
      await client.get({
        $id: 'root',
        id: true,
      })
    })
  }
)

test.serial(
  'authorize pass and defaultAuthorize missing should pass',
  async (t) => {
    const server = await createServer({
      port: 9333,
      db: {
        host: 'localhost',
        port: 9401,
      },
      config: {
        authorize: async ({ user }) => {
          return true
        },
      },
    })
    const client = based({
      url: async () => {
        return 'ws://localhost:9333'
      },
    })
    t.teardown(async () => {
      await server.destroy()
      client.disconnect()
    })

    await t.notThrowsAsync(async () => {
      const result = await client.get({
        $id: 'root',
        id: true,
      })
      t.is(result.id, 'root')
    })
  }
)

test.serial(
  'authorize fail and defaultAuthorize missing should fail',
  async (t) => {
    const server = await createServer({
      port: 9333,
      db: {
        host: 'localhost',
        port: 9401,
      },
      config: {
        authorize: async () => {
          return false
        },
      },
    })
    const client = based({
      url: async () => {
        return 'ws://localhost:9333'
      },
    })
    t.teardown(async () => {
      await server.destroy()
      client.disconnect()
    })

    await t.throwsAsync(async () => {
      await client.get({
        $id: 'root',
        id: true,
      })
    })
  }
)

test.serial(
  'authorize missing and defaultAuthorize missing should pass',
  async (t) => {
    const server = await createServer({
      port: 9333,
      db: {
        host: 'localhost',
        port: 9401,
      },
      config: {},
    })
    const client = based({
      url: async () => {
        return 'ws://localhost:9333'
      },
    })
    t.teardown(async () => {
      await server.destroy()
      client.disconnect()
    })

    await t.notThrowsAsync(async () => {
      const result = await client.get({
        $id: 'root',
        id: true,
      })
      t.is(result.id, 'root')
    })
  }
)
