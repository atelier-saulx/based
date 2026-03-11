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
    - load new db without changed types
    - make new schema (fill typeId gaps)
    - migrate changed/new types
  */
  const server = await testDbServer(t, { noBackup: true })
  const schema = {
    types: {
      a: {
        aName: 'string',
        bRefs: {
          ref: 'b',
          prop: 'aRefs',
        },
      },
      b: {
        bName: 'string',
        aRefs: {
          ref: 'a',
          prop: 'bRefs',
        },
      },
    },
  } as const
  const client = await testDbClient(server, schema)
  client.create('a', { aName: 'a name' })
  client.create('b', { bName: 'b name' })
  await client.drain()
  await server.save()
  const files = await readdir(t.tmp)
  for (const file of files) {
    if (file[0] === '2') {
      // remove type 2
      await rm(join(t.tmp, file))
    }
  }
  const server2 = new DbServer({ path: t.tmp })
  const client2 = await testDbClient(server, schema)
  console.log(files)
  console.log(await client2.query('a').include('*', '**').get())
  console.log(await client2.query('b').include('*', '**').get())
})
