import { testDbClient, testDbServer } from '../shared/index.js'
import { readdir, rm } from 'node:fs/promises'
import { DbServer } from '../../src/sdk.js'
import test from '../shared/test.js'
import { join } from 'node:path'

await test('type specific dumps', async (t) => {
  /*
    migration:
    - block all modifies
    - diff schema
    - make new schema (fill typeId gaps)
    - load new db without changed types
    - insert changed/new types
  */
  const server = await testDbServer(t, { noBackup: true })
  const schema = {
    types: {
      a: {
        aName: 'string',
        bRefs: {
          items: {
            ref: 'b',
            prop: 'aRefs',
          },
        },
      },
      b: {
        bName: 'string',
        aRefs: {
          items: {
            ref: 'a',
            prop: 'bRefs',
          },
        },
      },
    },
  } as const
  const client = await testDbClient(server, schema)
  const a = client.create('a', { aName: 'a name', bRefs: [] })
  client.create('b', { bName: 'b name', aRefs: [a] })
  await client.drain()
  console.log('a1:', await client.query('a').include('*', '**').get())
  console.log('b1:', await client.query('b').include('*', '**').get())
  await server.save()
  const files = await readdir(t.tmp)
  for (const file of files) {
    if (file[0] === '2') {
      // remove type 2
      await rm(join(t.tmp, file))
    }
  }
  const server2 = await testDbServer(t, { noBackup: true, noClean: true })
  const client2 = await testDbClient(server2, schema)
  console.log(files)
  console.log('a2:', await client2.query('a').include('*', '**').get())
  console.log('b2:', await client2.query('b').include('*', '**').get())
})
