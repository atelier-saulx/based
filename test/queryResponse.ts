import test from './shared/test.js'
import { testDb } from './shared/index.js'
import { equal } from './shared/assert.js'
import { notEqual } from 'assert'
import { extractNumber } from '../src/utils/index.js'
import { checksum } from '../src/db-query/query/index.js'

await test('correct version', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          status: ['a', 'b'],
        },
      },
    },
  })

  const user1 = await db.create('user', {
    status: 'a',
  })

  const response = await db.query('user', user1).get()

  equal(
    extractNumber(response.version),
    checksum(response),
    'Checksum is recoverable from the 53 bit js version number',
  )

  await db.update('user', user1, {
    status: 'b',
  })

  const response2 = await db.query('user', user1).get()

  notEqual(response.version, response2.version)
})
