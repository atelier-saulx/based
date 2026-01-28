import { BasedDb } from '../src/index.js'
import { AutoSizedUint8Array } from '../src/db-client/modify/AutoSizedUint8Array.js'
import {
  flush,
  getTypeDefs,
  serializeCreate,
} from '../src/db-client/modify/index.js'
import { parseSchema } from '../src/schema.js'
import { LangCode, Modify, pushModifyHeader } from '../src/zigTsExports.js'
import test from './shared/test.js'

await test.skip('schema defs', async (t) => {
  const schema = parseSchema({
    types: {
      // role: {
      //   name: 'string',
      // },
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
      // article: {
      //   user: {
      //     ref: 'user',
      //     prop: 'articles',
      //     $rating: 'number',
      //     $role: {
      //       ref: 'role',
      //     },
      //   },
      //   users: {
      //     items: {
      //       ref: 'user',
      //       prop: 'favourites',
      //     },
      //   },
      // },
    },
  })
  const defs = getTypeDefs(schema)
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
        // TODO refs have to be ordered
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

  buf.flush()

  console.log('done did it!')

  const res = await db.query('user').include('*', 'friends.*').get().toObject()
  console.dir(res, { depth: null })
})

await test('modify client', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        age: 'number',
        rating: 'uint8',
        // TODO refs have to be ordered
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

  const youzi = db.create('user', {
    age: 32,
    rating: 5,
    name: 'youzi',
  })

  // olli uses TMPID for youzi
  const olli = db.create('user', {
    age: 22,
    rating: 256,
    name: 'olli',
    friends: [youzi],
  })

  // youzi is now in-flight
  flush(db.client.modifyCtx)

  // james WILL BE QUEUED until youzi is done -> because we need that reference
  const jamez = db.create('user', {
    age: 24,
    rating: 54,
    name: 'jamez',
    friends: [youzi],
  })

  // this WILL NOT BE QUEUED ----> different order
  const marco = db.create('user', {
    age: 28,
    rating: 100,
    name: 'mr marco',
    // friends: [jamez],
  })

  const res = await db.query('user').include('*', 'friends').get().toObject()
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
