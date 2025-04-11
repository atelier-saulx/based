import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('number', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
    types: {
      user: {
        props: {
          bestFriend: {
            ref: 'user',
            prop: 'bestFriend',
            // $number: 'number',
            // $int8: 'int8',
            $uint8: 'uint8',
            // $int16: 'int16',
            // $uint16: 'uint16',
            // $int32: 'int32',
            // $uint32: 'uint32',
          },
        },
      },
    },
  })

  const user1 = await db.create('user', {})
  const user2 = await db.create('user', {
    bestFriend: {
      id: user1,
      $uint8: 1,
    },
  })
})
