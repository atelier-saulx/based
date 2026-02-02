import { getTypeDefs } from '../../dist/schema/defs/getTypeDefs.js'
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
            $level: 'number',
          },
        },
      },
    },
  })

  // console.log(getTypeDefs(client.schema!).get('user')?.main)

  const a = client.create('user', {
    name: 'AAAAAAAAAA',
    y: 67,
    x: true,
    flap: 9999,
    cook: {
      cookie: 1234,
    },
  })

  const b = client.create('user', {
    name: 'BBBBBBBBB',
    y: 67,
    x: true,
    flap: 9999,
    cook: {
      cookie: 1234,
    },
  })

  await client.create('user', {
    name: 'CCCCCCCCC',
    cook: {
      cookie: 1234,
    },
    y: 0,
    mrFriend: { id: a, $level: 67 },
    friends: [{ id: a, $level: 250 }, b],
  })

  await db.drain()

  console.log('-------')

  // let d = Date.now()

  const ast: QueryAst = {
    type: 'user',
    // filter: {
    //   props: {
    //     y: { ops: [{ op: '=', val: 0 }] },
    //     // add reference
    //     // add references
    //     // add edges
    //   },
    //   // add AND
    //   or: {
    //     props: {
    //       y: { ops: [{ op: '=', val: 67 }] },
    //     },
    //   },
    // },
    props: {
      // name: { include: {} },
      y: { include: {} },
      // mrFriend: {
      //   props: {
      //     y: { include: {} },
      //   },

      //   // EDGE

      //   edges: {
      //     props: {
      //       $level: { include: {} },
      //     },
      //   },
      // },
      // fix friends
      friends: {
        props: {
          name: { include: {} },
        },
        edges: {
          props: {
            $level: { include: {} },
          },
        },
      },
    },
  }

  const ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))

  // TODO
  // references
  // edges
  // TEXT - make this localized true
  // OPTS

  // console.dir(ctx, { depth: 10 })

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
