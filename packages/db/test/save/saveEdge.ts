import { BasedDb } from '../../src/index.ts'
import { foreachDirtyBlock } from '../../src/server/blocks.ts'
import { makeTreeKey } from '../../src/server/tree.ts'
import { deepEqual } from '../shared/assert.ts'
import test from '../shared/test.ts'

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

  //console.log(db.server.schema, '\n')
  //db.server.verifTree.foreachBlock(console.log)
  //console.log('dirtyRanges', db.server.dirtyRanges, '\n')
  foreachDirtyBlock(db.server, (_, typeId, start) => console.log(typeId, start))

  deepEqual(
    db.server.dirtyRanges.symmetricDifference(
      new Set([makeTreeKey(2, 1), makeTreeKey(3, 1)]),
    ).size,
    0,
  )

  deepEqual(await db.query('user', user2).include('**').get(), {
    id: 2,
    bestFriend: {
      id: 1,
      $uint8: 42,
    },
  })
})
