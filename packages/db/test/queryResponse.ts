import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { equal } from './shared/assert.js'
import { notEqual } from 'assert'

const getChecksum = (version: number) => {
  const BITS_FOR_B = 21
  const FACTOR = 2 ** BITS_FOR_B
  return Math.floor(version / FACTOR)
}

await test('correct version', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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
    getChecksum(response.version),
    response.checksum,
    'Checksum is recoverable from the 53 bit js version number',
  )

  await db.update('user', user1, {
    status: 'b',
  })

  const response2 = await db.query('user', user1).get()

  notEqual(response.version, response2.version)
})
