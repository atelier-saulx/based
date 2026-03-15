import test from '../shared/test.js'
import { DbClient, DbServer, getDefaultHooks } from '../../src/index.js'
import { setTimeout } from 'node:timers/promises'
import { deepEqual, throws } from '../shared/assert.js'
import { testDb, testDbClient, testDbServer } from '../shared/index.js'

await test('support many fields on type', async (t) => {
  const props: Record<string, any> = {}
  for (let i = 0; i < 248; i++) {
    props['myProp' + i] = 'string'
  }

  await testDb(t, {
    types: {
      flurp: props,
    },
  })
})

await test('schema hash', async (t) => {
  const server = await testDbServer(t)
  const client = await testDbClient(server, {
    types: {
      flurp: {
        name: 'string',
      },
    },
  })

  const hash1 = server.schema!.hash

  await client.setSchema({
    types: {
      flurp: {
        name: 'string',
        title: 'string',
      },
    },
  })

  const hash2 = server.schema!.hash

  if (!hash1 || !hash2 || hash1 === hash2) {
    throw new Error('Incorrect hash')
  }
})

await test('dont accept modify with mismatch schema', async (t) => {
  const server = await testDbServer(t)
  const client = new DbClient({
    hooks: Object.assign(getDefaultHooks(server), {
      async flushModify(buf: Uint8Array) {
        buf = new Uint8Array(buf)
        await setTimeout(100)
        return server.modify(buf)
      },
    }),
  })

  await client.setSchema({
    types: {
      flurp: {
        name: 'string',
      },
    },
  })

  await client.create('flurp', {
    name: 'xxx',
  })

  const q1 = client.query('flurp')
  const setSchemaPromise = client.setSchema({
    types: {
      flurp: {
        title: 'string',
      },
    },
  })

  client.create('flurp', {
    name: 'yyy',
  })

  await setSchemaPromise

  throws(() => {
    return client.create('flurp', {
      name: 'zzz',
    })
  })

  const res = (await client.query('flurp').get()) as any

  deepEqual(res, [
    { id: 1, title: '' },
    { id: 2, title: '' },
  ])
})

await test('set schema before start', async (t) => {
  const server = new DbServer({ path: t.tmp })
  const client = await testDbClient(server)

  await throws(() =>
    client.setSchema({
      types: {
        flurp: {
          props: {
            x: 'uint8',
          },
        },
      },
    }),
  )

  await server.start({ clean: true })
  t.after(() => server.destroy())
})
