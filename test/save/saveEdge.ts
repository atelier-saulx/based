import { deepEqual } from '../shared/assert.js'
import { DbServer } from '../../src/sdk.js'
import { testDbClient } from '../shared/index.js'
import test from '../shared/test.js'

await test('save edge', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await testDbClient(db, {
    types: {
      user: {
        props: {
          bestFriend: {
            ref: 'user',
            prop: 'bestFriend',
            $bond: 'uint8',
          },
        },
      },
    },
  })

  const user1 = await client.create('user', {})
  const user2 = await client.create('user', {
    bestFriend: {
      id: user1,
      $bond: 21,
    },
  })

  await db.save()

  await client.update('user', user2, {
    bestFriend: {
      id: user1,
      $bond: 42,
    },
  })

  deepEqual(
    await client.query('user', user2).include('**', 'bestFriend.$bond').get(),
    {
      id: 2,
      bestFriend: {
        id: 1,
        $bond: 42,
      },
    },
  )
})
