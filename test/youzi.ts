import { BasedDb } from '../src/index.js'
import { AutoSizedUint8Array } from '../src/modify/AutoSizedUint8Array.js'
import { getTypeDefs, serializeCreate } from '../src/modify/index.js'
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

await test('modify', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await db.setSchema({
    types: {
      user: {
        age: 'number',
        rating: 'uint8',
      },
    },
  })

  const buf = new AutoSizedUint8Array()
  const index = pushModifyHeader(buf, {
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
    },
    buf,
    LangCode.nl,
  )

  await db.server.modify(new Uint8Array(buf.view))
  buf.flush()

  console.log('done did it!')
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
