import { testDbClient } from '../shared/index.js'
import { type SchemaIn } from '../../src/sdk.js'
import test from '../shared/test.js'
import { DbServerWrapper } from '../../src/db-server/index.js'

await test('migration playground', async (t) => {
  const server = new DbServerWrapper({ path: t.tmp })
  // const server = await testDbServer(t, { noBackup: true })
  await server.start({ clean: true })
  t.after(() => server.destroy())
  const client = await testDbClient(server as any, {
    types: {
      a: {
        aName: 'string',
        bRefs: {
          items: {
            ref: 'b',
            prop: 'aRefs',
            // $rank: 'number',
          },
        },
      },
      b: {
        bName: 'string',
        aRefs: {
          items: {
            ref: 'a',
            prop: 'bRefs',
            // $rank: 'number',
          },
        },
      },
      c: {
        age: 'number',
      },
    },
  })
  let i = 1000_000
  while (i--) {
    const a = client.create('a', { aName: 'a name', bRefs: [] })
    client.create('b', { bName: 'b name', aRefs: [a] })
  }

  await client.drain()
  console.log('before:', {
    a: await client.query('a').include('*', '**').get(),
    b: await client.query('b').include('*', '**').get(),
  })

  await client.setSchema({
    types: {
      a: {
        aName: 'string',
        bRefs: {
          items: {
            ref: 'b',
            prop: 'aRefs',
            // $rank: 'number',
          },
        },
      },
      aNew: {
        name: 'string',
      },
      b: {
        bName: 'string',
        aRefs: {
          items: {
            ref: 'a',
            prop: 'bRefs',
            // $rank: 'number',
          },
        },
      },
      c: {
        age: 'uint8',
      },
    },
  })

  console.log('wut')
  console.log('after:', {
    a: await client.query('a').include('*', '**').get(),
    b: await client.query('b').include('*', '**').get(),
  })
})
