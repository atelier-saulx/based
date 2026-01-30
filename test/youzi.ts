import { BasedDb } from '../src/index.js'
import { AutoSizedUint8Array } from '../src/utils/AutoSizedUint8Array.js'
import { LangCode, pushModifyHeader } from '../src/zigTsExports.js'
import {
  flush,
  getTypeDefs,
  serializeCreate,
} from '../src/db-client/modify/index.js'
import { parseSchema } from '../src/schema.js'
import test from './shared/test.js'

await test('schema-defs', async (t) => {
  const schema = parseSchema({
    types: {
      user: {
        age: 'number',
        rating: 'uint8',
        nested: {
          props: {
            friends: {
              items: {
                ref: 'user',
                prop: 'nested.friends',
                $rating: 'number',
              },
            },
          },
        },
      },
    },
  })
  const defs = getTypeDefs(schema)
  console.dir(defs, { depth: 3 })
})

await test.skip('modify raw', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        age: 'number',
        rating: 'uint8',
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
            $rank: 'uint8',
          },
        },
        name: 'string',
      },
    },
  })

  const buf = new AutoSizedUint8Array()
  pushModifyHeader(buf, {
    opId: 0, // is filled on server
    opType: 0, // is filled on server
    schema: 0,
    count: 1,
  })

  serializeCreate(
    db.client.schema!,
    'user',
    {
      age: 32,
      rating: 5,
      name: 'youzi',
    },
    buf,
    LangCode.nl,
  )

  serializeCreate(
    db.client.schema!,
    'user',
    {
      age: 24,
      rating: 54,
      name: 'jamez',
      friends: [{ id: 1, $rank: 5 }],
    },
    buf,
    LangCode.nl,
  )

  await db.server.modify(buf.view)

  const res = await db.query('user').include('*', 'friends.*').get().toObject()
  console.dir(res, { depth: null })
})

await test.skip('modify client', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  // When using setSchema, the return value is a typed client
  const client = await db.setSchema({
    types: {
      user: {
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
            $rank: 'uint8',
          },
        },
        friend: {
          ref: 'user',
          prop: 'friend',
          $rating: 'uint8',
        },
        name: 'string',
      },
    },
  })

  const youzi = client.create('user', {
    name: 'youzi',
  })

  // olli uses BasedModify for youzi
  const olli = client.create('user', {
    name: 'olli',
    friends: { add: [youzi] },
    friend: youzi,
  })

  // youzi is now in-flight
  flush(db.client.modifyCtx)

  const jamez = client.create('user', {
    name: 'jamez',
    friend: { id: youzi, $rating: 10 },
  })

  const marco = client.create('user', {
    name: 'mr marco',
    friends: [youzi],
  })

  jamez.then((jamezId) => {
    const fulco = client
      .create('user', {
        name: 'mr fulco',
        friends: [jamezId],
        friend: jamezId,
      })
      .then(() => {
        const tom = client
          .create('user', {
            name: 'mr tom',
            friends: [jamezId],
            friend: jamezId,
          })
          .then()
      })
  })

  // this will await all queued modifies
  const res = await db.query('user').include('*', 'friend').get().toObject()
  console.dir(res, { depth: null })
})

// await test('reffies', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//   })

//   await db.start({ clean: true })

//   t.after(() => t.backup(db))

//   await db.setSchema({
//     types: {
//       user: {
//         name: 'string',
//         others: {
//           items: {
//             ref: 'user',
//             prop: 'others',
//             $rating: 'number',
//           },
//         },
//       },
//     },
//   })

//   const userId = await db.create('user', { name: 'a' })

//   await db.create('user', {
//     others: [
//       {
//         id: userId,
//         $rating: 20,
//       },
//     ],
//     // others: [userId],
//     name: 'bxxxxxxxx',
//   })

//   const res = await db.query('user').include('*', '**').get().toObject()

//   console.dir(res, { depth: null })
// })
