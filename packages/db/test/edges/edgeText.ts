import { BasedDb } from '../../src/db.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

// Text is currently not supported in edge props: FDN-1713 FDN-730
await test.skip('text in an edge prop', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    locales: {
      en: {},
      it: { fallback: 'en' },
    },
    types: {
      user: {
        props: {
          bestFriend: {
            ref: 'user',
            prop: 'bestFriend',
            $x: 'text',
          },
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
              $x: 'text',
            },
          },
        },
      },
    },
  })

  const user1 = await db.create('user', {})
  const user2 = await db.create('user', {
    bestFriend: {
      id: user1,
      $x: { en: 'hello' },
    },
  })
  deepEqual(await db.query('user', user2).include('**').get(), {
    id: user2,
    bestFriend: {
      id: user1,
      $x: { en: 'hello' },
    },
    friends: [],
  })

  const user3 = await db.create('user', {
    bestFriend: { id: user2, $x: { en: 'hello' } },
    friends: [
      { id: user1, $x: { en: 'hello' } },
      { id: user2, $x: { en: 'hello' } },
    ],
  })
  deepEqual(await db.query('user', user1).include('**').get(), {
    id: user1,
    bestFriend: null,
    friends: [{ id: user3, $x: { en: 'hello' } }],
  })
  deepEqual(await db.query('user', user3).include('**').get(), {
    id: user3,
    bestFriend: {
      id: user2,
      $x: {},
    },
    friends: [
      { id: user1, $x: { en: 'hello' } },
      { id: user2, $x: { en: 'hello' } },
    ],
  })

  await db.update('user', user3, {
    friends: { update: [{ id: user2, $index: 0 }] },
  })
  deepEqual(await db.query('user', user3).include('**').get(), {
    id: user3,
    bestFriend: { id: user2, $x: 0 },
    friends: [
      { id: user2, $x: { en: 'hello' } },
      { id: user1, $x: { en: 'hello' } },
    ],
  })
})
