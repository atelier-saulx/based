import { deflate } from 'fflate'
import { QueryAst } from '../../src/db-query/ast/ast.js'
import { astToQueryCtx } from '../../src/db-query/ast/toCtx.js'
import {
  resultToObject,
  serializeReaderSchema,
} from '../../src/protocol/index.js'
import { BasedDb, debugBuffer } from '../../src/sdk.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'
import { writeUint16, writeUint32 } from '../../src/utils/uint8.js'
import wait from '../../src/utils/wait.js'
import { perf } from '../shared/perf.js'
import test from '../shared/test.js'
import { deflateSync } from 'zlib'

await test('include', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })
  t.after(() => db.destroy())
  const client = await db.setSchema({
    types: {
      friend: {
        y: 'uint32',
      },
      user: {
        name: 'string',
        x: 'boolean',
        flap: 'uint32',
        y: 'uint32',
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

  const a = client.create('user', {
    name: 'mr snurf a',
    y: 4,
    x: true,
    flap: 9999,
    cook: {
      cookie: 1234,
    },
  })

  const b = client.create('user', {
    name: 'mr snurf b',
    y: 15,
    x: true,
    flap: 9999,
    cook: {
      cookie: 1234,
    },
  })

  let d = Date.now()

  for (let i = 0; i < 10; i++) {
    client.create('user', {
      name: `mr snurf ${i}`,
      y: i,
      x: true,
      flap: 9999,
      cook: {
        cookie: 1234,
      },
    })
  }

  await db.drain()

  console.log(Date.now() - d, 'ms')

  const ast: QueryAst = {
    type: 'user',
    filter: {
      // props: {
      //   name: {
      //     // ADD LOWER CASE
      //     // ops: [{ op: 'includes', val: 'flap', opts: { lowerCase: true } }],
      //     ops: [{ op: 'includes', val: 'x' }],
      //   },
      // },
      props: {
        flap: { ops: [{ op: '=', val: 9999 }] },
      },
      and: {
        props: {
          y: { ops: [{ op: '=', val: 100 }] },
        },
        or: {
          props: {
            y: { ops: [{ op: '=', val: 3 }] },
          },
          or: {
            props: {
              y: { ops: [{ op: '=', val: 4 }] },
            },
          },
        },
      },
      or: {
        props: {
          y: { ops: [{ op: '=', val: 670 }] },
        },
        or: {
          props: {
            y: { ops: [{ op: '=', val: 15 }] },
          },
        },
      },
    },

    // filter('flap', '=', 9999)
    //   .and(q => {
    //     q.filter('y', '=', 100)
    //       .or('y', '=', 3)
    //       .or('y', '=', 4)
    //   })
    //   .or('y','=', 670)
    //   .or('y', '=', 15)

    // (y == 0 && (y == 10 || y == 3 || y == 4)) || y == 67

    props: {
      y: { include: {} },
      name: { include: {} },
      mrFriend: {
        props: {
          y: { include: {} },
        },
        // edges: {
        //   props: {
        //     $level: { include: {} },
        //   },
        // },
      },
    },
  }

  // (1: y == 0 && ( 2: y == 10 || 4: y == 3)) || 3: y == 67

  // so the thing is we need to keep track of the NEXT or vs query.len

  // ->:3 :1 ->:4 :2 ->:3 :4

  const ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))

  debugBuffer(ctx.query)

  console.log(deflateSync(ctx.query).byteLength)

  debugBuffer(deflateSync(ctx.query).toString('hex'))

  const result = await db.server.getQueryBuf(ctx.query)
  const queries: any = []
  for (let i = 0; i < 10; i++) {
    const x = ctx.query.slice(0)
    writeUint32(x, i + 1, 0)
    queries.push(x)
  }

  await perf.skip(
    async () => {
      const q: any = []
      for (let i = 0; i < 10; i++) {
        q.push(db.server.getQueryBuf(queries[i]))
      }
      await Promise.all(q)
    },
    'filter speed',
    {
      repeat: 10,
    },
  )
  // quite large

  // deflate it?

  const readSchemaBuf = serializeReaderSchema(ctx.readSchema)

  const obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  console.dir(obj, { depth: 10 })

  // RETURN NULL FOR UNDEFINED

  // console.log(
  //   JSON.stringify(obj).length,
  //   readSchemaBuf.byteLength + result.byteLength,
  // )
})
