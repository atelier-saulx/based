import {
  BasedDb,
  DbClient,
  DbServer,
  getDefaultHooks,
} from '../../src/index.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('clientServer', async (t) => {
  const server = new DbServer({
    path: t.tmp,
  })

  const schema = {
    types: {
      user: {
        name: 'string',
      },
    },
  } as const

  const client = new DbClient<typeof schema>({
    hooks: getDefaultHooks(server),
  })

  const client2 = await testDb(t, schema)
})
