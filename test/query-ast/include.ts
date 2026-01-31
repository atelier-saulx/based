import { deSerializeSchema } from '../../dist/protocol/db-read/schema/deserialize.js'
import { convertToReaderSchema } from '../../src/db-client/query/queryDefToReadSchema.js'
import { registerQuery } from '../../src/db-client/query/registerQuery.js'
import { QueryAst } from '../../src/db-query/ast/ast.js'
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
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
            $level: 'uint32',
          },
        },
      },
    },
  })

  const a = await client.create('user', {
    name: 'AAAAAAAAAA',
    y: 67,
    x: true,
    flap: 9999,
    cook: {
      cookie: 1234,
    },
  })

  const b = await client.create('user', {
    name: 'BBBBBBBBB',
    y: 67,
    x: true,
    flap: 9999,
    cook: {
      cookie: 1234,
    },
  })

  client.create('user', {
    name: 'CCCCCCCCC',
    cook: {
      cookie: 1234,
    },
    // mrFriend: { id: a, $level: 67 },
    friends: [{ id: a, $level: 250 }, b],
  })

  await db.drain()

  console.log('-------')

  // let d = Date.now()

  const ast: QueryAst = {
    type: 'user',
    filter: {
      props: {
        y: { ops: [{ op: '=', val: 67 }] },
      },
    },
    props: {
      name: { include: {} },
      y: { include: {} },
      // x: { include: {} },
      // cook: {
      //   props: {
      //     cookie: { include: {} },
      //   },
      // },
      // // NOW ADD MR FRIEND!
      // mrFriend: {
      //   props: {
      //     name: { include: {} },
      //   },
      //   edges: {
      //     props: {
      //       $level: { include: {} },
      //     },
      //   },
      // },
      // friends: {
      //   props: {
      //     name: { include: {} },
      //   },
      //   edges: {
      //     props: {
      //       $level: { include: {} },
      //     },
      //   },
      // },
    },
  }

  const ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))

  // TODO
  // references
  // edges
  // TEXT - make this localized true
  // OPTS

  console.dir(ctx, { depth: 10 })

  const result = await db.server.getQueryBuf(ctx.query)
  debugBuffer(result)

  const readSchemaBuf = serializeReaderSchema(ctx.readSchema)

  const obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  console.dir(obj, { depth: 10 })

  console.log(
    JSON.stringify(obj).length,
    readSchemaBuf.byteLength + result.byteLength,
  )
})
