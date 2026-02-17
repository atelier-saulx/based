import wait from '../../src/utils/wait.js'
import { deepEqual, testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('query db', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
      nl: true,
    },
    types: {
      user: {
        name: 'string',
        expiresAt: {
          type: 'timestamp',
          expire: true,
        },
      },
    },
  })

  const expiresAt = Date.now() + 1e3
  const john = await db.create('user', {
    name: 'john',
    expiresAt,
  })

  deepEqual(await db.query2('user', john).get(), {
    id: 1,
    name: 'john',
    expiresAt,
  })
  await wait(1e3)
  deepEqual(await db.query2('user', john).get(), null)
})
