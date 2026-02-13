import type { InferPayload } from '../../../src/db-client/modify/types.js'
import { parseSchema } from '../../../src/schema.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - hooks - create', async (t) => {
  // const db = await testDb(t, {
  //   types: {
  //     user: {
  //       props: {
  //         isNice: {
  //           type: 'boolean',
  //           hooks: {
  //             create(value) {
  //               // @ts-expect-error
  //               const isNiceNumber: number = value
  //             },
  //           },
  //         },
  //       },
  //       hooks: {
  //         create(payload) {
  //           const isNice: boolean = payload.isNice
  //           // @ts-expect-error
  //           const randomKey: any = payload.randomKey
  //         },
  //       },
  //     },
  //   },
  // })

  parseSchema({
    types: {
      user: {
        props: {
          isNice: 'boolean',
        },
        hooks: {
          create(payload) {
            const isNice: boolean | null | undefined = payload.isNice
            // @ts-expect-error
            const isWrong: boolean | null | undefined = payload.isWrong
          },
        },
      },
    },
  })

  const schema = {
    types: {
      user: {
        props: {
          isNice: 'boolean',
        },
        hooks: {
          create(payload) {},
        },
      },
    },
  } as const

  const payload: InferPayload<typeof schema, 'user'> = {}
  const isNice: boolean | null | undefined = payload.isNice
  // @ts-expect-error
  const isWrong: boolean | null | undefined = payload.isWrong

  // const schema: SchemaIn = {

  // }

  // await db.create('user', {
  //   isNice: true,
  // })
})
