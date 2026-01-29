import { deSerializeSchema } from '../../dist/protocol/db-read/schema/deserialize.js'
import { convertToReaderSchema } from '../../src/db-client/query/queryDefToReadSchema.js'
import { registerQuery } from '../../src/db-client/query/registerQuery.js'
import { astToQueryCtx } from '../../src/db-query/ast/toCtx.js'
import {
  resultToObject,
  serializeReaderSchema,
} from '../../src/protocol/index.js'
import { BasedDb, debugBuffer } from '../../src/sdk.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'

import test from '../shared/test.js'

await test('include', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })
  t.after(() => db.destroy())
  const client = await db.setSchema({
    types: {
      user: {
        name: 'string',
        x: 'boolean',
        flap: 'uint32',
        y: 'uint16',
        cook: {
          type: 'object',
          props: {
            cookie: 'number',
          },
        },
        mrFriend: {
          ref: 'user',
          prop: 'mrFriend',
          $level: 'uint32',
        },
      },
    },
  })

  const a = client.create('user', {
    name: 'AAAAAAAAAA',
    y: 67,
    x: true,
    flap: 9999,
    cook: {
      cookie: 1234,
    },
  })
  // client.create('user', {
  //   name: 'mr y',
  //   cook: {
  //     cookie: 1234,
  //   },
  //   mrFriend: { id: a, $level: 67 },
  // })

  await db.drain()

  console.log('-------')

  let d = Date.now()

  const ast = {
    type: 'user',
    props: {
      name: { include: {} },
      y: { include: {} },
      x: { include: {} },
      cook: {
        props: {
          cookie: { include: {} },
        },
      },
      // mrFriend: {
      //   // props: {
      //   //   name: { include: {} },
      //   // },
      //   edges: {
      //     props: {
      //       $level: { include: {} },
      //     },
      //   },
      // },
    },
  }

  const ctx = astToQueryCtx(
    client.schema!,
    ast,
    new AutoSizedUint8Array(1000), // this will be shared
    new AutoSizedUint8Array(1000), // this will be shared
  )

  console.dir(ctx, { depth: 10 })

  const result = await db.server.getQueryBuf(ctx.query)
  debugBuffer(result)

  console.log(resultToObject(ctx.readSchema, result, result.byteLength - 4))
})
