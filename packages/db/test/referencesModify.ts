import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('references modify', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
            },
          },
        },
      },
    },
  })

  const bob = await db.create('user', {
    name: 'bob',
  })

  const marie = await db.create('user', {
    name: 'marie',
  })

  const john = await db.create('user', {
    name: 'john',
    friends: [bob],
  })

  console.log(
    await db.update('user', john, {
      friends: {
        delete: [bob],
        add: [marie],
      },
    }),
  )

  console.dir(db.query('user').include('friends').get().toObject(), {
    depth: null,
  })

  // deepEqual(
  //   db.query('user').include('friends').get().toObject(),
  //   {
  //     id: 1,
  //     contributors: [
  //       { id: 4, name: 'Dinkel Doink', flap: 40 },
  //       { id: 3, name: 'Derpie', flap: 30 },
  //     ],
  //   },
  //   'Filter references and sort',
  // )

  // db.update('user', john, {
  //   friends: {
  //     delete: bob,
  //     add: [{
  //       id: marie,
  //       $index: 1,
  //     }],
  //   },
  // })

  // console.log({ a, b })
})
