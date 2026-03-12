import { testDbClient, testDbServer } from '../shared/index.js'
import { DbServer } from '../../src/sdk.js'
import test from '../shared/test.js'
import { join } from 'node:path'
import { mkdir, readdir } from 'node:fs/promises'

await test('migration playground', async (t) => {
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
  const migrationDir = join(t.tmp, 'migration')
  await mkdir(migrationDir).catch(() => {})
  const server2 = new DbServer({ path: migrationDir })
  const client2 = await testDbClient(server, {
    // @ts-ignore
    types: Object.assign(schema.types, {
      c: {
        bName: 'string',
        aRefs: {
          ref: 'a',
          prop: 'bRefs',
        },
      },
    }),
  })
  client2.create('c', { cName: 'c name' })
  await client.drain()
  const files = await readdir(migrationDir)

  console.log({ files })
})
