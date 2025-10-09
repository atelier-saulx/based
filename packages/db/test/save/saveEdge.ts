import { BasedDb } from '../../src/index.js'
import {foreachDirtyBlock} from '../../src/server/blocks.js'
import { deepEqual } from '../shared/assert.js'
import test from '../shared/test.js'

await test('save edge', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          bestFriend: {
            ref: 'user',
            prop: 'bestFriend',
            $uint8: 'uint8',
          },
        },
      },
    },
  })

  const user1 = await db.create('user', {})
  const user2 = await db.create('user', {
    bestFriend: {
      id: user1,
      $uint8: 21,
    },
  })

  await db.save()

  await db.update('user', user2, {
    bestFriend: {
      id: user1,
      $uint8: 42,
    },
  })
  console.log(db.server.schema)
  console.log(db.server.dirtyRanges)
    foreachDirtyBlock(db.server, (_, typeId, start) => console.log(typeId, start))

  deepEqual(await db.query('user', user2).include('**').get(), {
    id: 2,
    bestFriend: {
      id: 1,
      $uint8: 42,
    },
  })
})
