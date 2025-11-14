import { BasedDb } from '../src/index.ts'
import test from './shared/test.ts'
import { deepEqual } from './shared/assert.ts'

await test('alignModify - putrefs', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const flushModify = db.client.hooks.flushModify

  db.client.hooks.flushModify = (buf) => {
    const shifted = new Uint8Array(buf.byteLength + 1)
    shifted.set(buf, 1)
    return flushModify(shifted.subarray(1))
  }

  await db.setSchema({
    types: {
      user: {
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
        str: 'string',
      },
    },
  })

  const user1 = await db.create('user')
  const user2 = await db.create('user')
  let i = 10
  while (i--) {
    db.create('user', {
      friends: [user1, user2],
      str: Array(i + 2).join('x'),
    })
  }
  await db.drain()
  const res = await db.query('user').include('friends', 'str').get().toObject()
  deepEqual(res, [
    {
      id: 1,
      friends: [
        { id: 3, str: 'xxxxxxxxxx' },
        { id: 4, str: 'xxxxxxxxx' },
        { id: 5, str: 'xxxxxxxx' },
        { id: 6, str: 'xxxxxxx' },
        { id: 7, str: 'xxxxxx' },
        { id: 8, str: 'xxxxx' },
        { id: 9, str: 'xxxx' },
        { id: 10, str: 'xxx' },
        { id: 11, str: 'xx' },
        { id: 12, str: 'x' },
      ],
      str: '',
    },
    {
      id: 2,
      friends: [
        { id: 3, str: 'xxxxxxxxxx' },
        { id: 4, str: 'xxxxxxxxx' },
        { id: 5, str: 'xxxxxxxx' },
        { id: 6, str: 'xxxxxxx' },
        { id: 7, str: 'xxxxxx' },
        { id: 8, str: 'xxxxx' },
        { id: 9, str: 'xxxx' },
        { id: 10, str: 'xxx' },
        { id: 11, str: 'xx' },
        { id: 12, str: 'x' },
      ],
      str: '',
    },
    {
      id: 3,
      str: 'xxxxxxxxxx',
      friends: [
        { id: 1, str: '' },
        { id: 2, str: '' },
      ],
    },
    {
      id: 4,
      str: 'xxxxxxxxx',
      friends: [
        { id: 1, str: '' },
        { id: 2, str: '' },
      ],
    },
    {
      id: 5,
      str: 'xxxxxxxx',
      friends: [
        { id: 1, str: '' },
        { id: 2, str: '' },
      ],
    },
    {
      id: 6,
      str: 'xxxxxxx',
      friends: [
        { id: 1, str: '' },
        { id: 2, str: '' },
      ],
    },
    {
      id: 7,
      str: 'xxxxxx',
      friends: [
        { id: 1, str: '' },
        { id: 2, str: '' },
      ],
    },
    {
      id: 8,
      str: 'xxxxx',
      friends: [
        { id: 1, str: '' },
        { id: 2, str: '' },
      ],
    },
    {
      id: 9,
      str: 'xxxx',
      friends: [
        { id: 1, str: '' },
        { id: 2, str: '' },
      ],
    },
    {
      id: 10,
      str: 'xxx',
      friends: [
        { id: 1, str: '' },
        { id: 2, str: '' },
      ],
    },
    {
      id: 11,
      str: 'xx',
      friends: [
        { id: 1, str: '' },
        { id: 2, str: '' },
      ],
    },
    {
      id: 12,
      str: 'x',
      friends: [
        { id: 1, str: '' },
        { id: 2, str: '' },
      ],
    },
  ])
})
