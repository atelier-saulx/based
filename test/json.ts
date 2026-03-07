import { notEqual } from 'node:assert'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import { testDb } from './shared/index.js'
import { checksum as q2checksum } from '../../src/db-query/query/index.js'

await test('json', async (t) => {
  const db = await testDb(t, {
    types: {
      jsonDerulo: {
        name: 'string',
        myJson: 'json',
      },
    },
  })

  const derulo = {
    name: 'jason',
    myJson: {
      bllz: {
        to: {
          the: 'wallz',
        },
      },
    },
  }

  await db.create('jsonDerulo', derulo)

  deepEqual(
    await db.query('jsonDerulo').get(),
    [
      {
        id: 1,
        ...derulo,
      },
    ],
    'simple',
  )

  const jay = await db.create('jsonDerulo', {
    myJson: {},
  })

  deepEqual(
    await db.query('jsonDerulo').get(),
    [
      { id: 1, ...derulo },
      { id: 2, myJson: {}, name: '' },
    ],
    'after empty object',
  )

  await db.update('jsonDerulo', jay, {
    myJson: null,
  })

  deepEqual(
    await db.query('jsonDerulo').get(),
    [
      { id: 1, ...derulo },
      { id: 2, myJson: null, name: '' },
    ],
    'json null',
  )
})

await test('json and crc32', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        article: {
          type: 'json',
        },
      },
    },
  })

  const user1 = await db.create('user', {
    article: 'a',
  })

  const checksum = q2checksum(await db.query('user', user1).get())

  await db.update('user', user1, {
    article: 'b',
  })

  const checksum2 = q2checksum(await db.query('user', user1).get())

  notEqual(checksum, checksum2, 'Checksum is not the same')
})
