import { parseSchema } from '../../../src/schema.js'
import { testDb } from '../../shared/index.js'

async function check() {
  const schemaOut = parseSchema({
    types: {
      user: {
        other: {
          ref: 'other',
          prop: 'user',
        },
      },
      other: {
        user: {
          ref: 'user',
          prop: 'other',
        },
      },
    },
  })

  // @ts-expect-error
  schemaOut.types.foo = {}

  const db = await testDb(null as any, {
    types: {
      user: {
        other: {
          ref: 'other',
          prop: 'user',
        },
      },
      other: {
        user: {
          ref: 'user',
          prop: 'other',
        },
      },
    },
  })

  db.create('user', {})
}

// import type { InferPayload } from '../../../src/db-client/modify/types.js'
// import { parseSchema, type SchemaIn } from '../../../src/schema.js'

// // Simple test case to verify strict typing of create hook payload
// const bla = parseSchema({
//   types: {
//     user: {
//       props: {
//         isNice: 'boolean',
//       },
//       //   testPayload: {
//       //     // @ts-expect-error
//       //     isNice: number,
//       //   },
//       hooks: {
//         create(payload) {
//           const isNice: boolean | null | undefined = payload!.isNice
//           // @ts-expect-error
//           const isWrong: boolean | null | undefined = payload.isWrong

//           return payload
//         },
//       },
//       //   testhooks: {
//       //     create(payload) {
//       //       const isNice: boolean | null | undefined = payload.isNice
//       //       // @ts-expect-error
//       //       const isWrong: boolean | null | undefined = payload.isWrong
//       //     },
//       //   },
//     },
//   },
// })

// bla.types.haha

// const schema = {
//   types: {
//     user: {
//       props: {
//         isNice: 'boolean',
//       },
//     },
//   },
// } as const

// const payload: InferPayload<typeof schema, 'user'> = {}
// const isNice: boolean | null | undefined = payload.isNice
// // @ts-expect-error
// const isWrong: boolean | null | undefined = payload.isWrong
