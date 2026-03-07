import { QueryAst } from '../../src/db-query/ast/ast.js'
import { astToQueryCtx } from '../../src/db-query/ast/toCtx.js'
import { resultToObject } from '../../src/protocol/index.js'
import { BasedDb, debugBuffer } from '../../src/sdk.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'
import { writeUint32 } from '../../src/utils/uint8.js'
import wait from '../../src/utils/wait.js'
import { perf } from '../shared/perf.js'
import test from '../shared/test.js'
import { deflateSync } from 'zlib'
import { fastPrng } from '../../src/utils/fastPrng.js'
import { italy } from '../shared/examples.js'

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
        derp: { type: 'string', maxBytes: 2 },
        name: 'string',
        big: { type: 'string', compression: 'none' },
        x: 'boolean',
        flap: 'uint32',
        enum: ['ok', 'bad', 'great'],
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

  let syntheticData = ''

  // for (let i = 0; i < 125e3; i++) {
  //   syntheticData += 'ab'
  // }

  // for (let i = 0; i < 200; i++) {
  //   syntheticData += 'ab'
  // }

  syntheticData = italy

  // syntheticData = 'my snurfelbag my snurfelBag my snurfelbag my snurfelbag'

  const a = client.create('user', {
    name: 'mr jim',
    big: syntheticData,
    enum: 'ok',
    derp: 'aa',
    y: 4,
    x: false,
    flap: 9999,
    cook: {
      cookie: 1234,
    },
  })

  const b = await client.create('user', {
    name: 'mr snurf b',
    derp: 'bb',
    y: 15,
    x: true,
    flap: 9999,
    cook: {
      cookie: 1234,
    },
    mrFriend: { id: a, $level: 67 },
  })

  let d = Date.now()

  const rand = fastPrng()

  for (let i = 0; i < 1e6; i++) {
    client.create('user', {
      // big: syntheticData,
      name: `mr snurf ${i}`,
      derp: 'cc',
      y: i,
      x: !!(i % 2),
      enum: i % 2 ? 'great' : null,
      flap: 9999,
      cook: {
        cookie: 1234,
      },
      // friends: [
      //   { id: a, $level: rand(0, 200) },
      //   { id: b, $level: rand(0, 200) },
      // ],
    })
  }

  // for sort 1M we can prob do better with either INDEX (scince it will refire)

  await db.drain()

  console.log('mod create done', Date.now() - d, 'ms')

  // filter: RE-ADD REFERENCE
  // filter: REFERENCES

  // GET REFERENCEs
  // SORT REFERENCES
  // FILTER REFENRRENS
  // FILTER REFS BY EDGE
  // ALIAS

  const bigArray: string[] = []
  for (let i = 0; i < 1e3; i++) {
    bigArray.push(i % 2 ? 'xy' : 'xx')
  }

  const ast: QueryAst = {
    type: 'user',
    range: { start: 0, end: 3 },
    filter: {
      props: {
        derp: {
          ops: [
            { op: '=', val: bigArray },
            // bigArray

            // { op: '=', val: ['ok', 'bad', 'great'] },
            // { op: 'includes', val: 'xbl@apx', opts: { lowerCase: true } },
            // { op: 'like', val: 'xblapx' },
            // { op: 'includes', val: ' xaderp', opts: { lowerCase: true } },
            // {
            //   op: 'includes',
            //   val: 'a{"name":true}',
            //   opts: { lowerCase: true },
            // },
          ],
        },
      },
    },
    props: {
      // big: { include: {} },
      y: { include: {} },
      name: { include: {} },
      derp: { include: {} },
      x: { include: {} },
      enum: { include: {} },
      friends: {
        props: {
          name: { include: {} },
          y: { include: {} },
          x: { include: {} },
        },
      },
    },
  }

  console.dir(ast, { depth: 10 })

  const ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))

  debugBuffer(ctx.query)

  console.log(deflateSync(ctx.query).byteLength)

  debugBuffer(deflateSync(ctx.query).toString('hex'))

  const queries: any = []
  for (let i = 0; i < 10; i++) {
    const x = ctx.query.slice(0)
    writeUint32(x, i + 1, 0)
    queries.push(x)
  }

  console.log('START PERF', Date.now() - d, 'ms')

  await perf(
    async () => {
      const q: any = []
      for (let i = 0; i < 10; i++) {
        q.push(db.server.getQueryBuf(queries[i]))
      }
      const x = await Promise.all(q)
      // console.log(x)
    },
    'filter speed',
    {
      repeat: 10,
    },
  )

  console.log(' PERF DONE', Date.now() - d, 'ms')

  // const readSchemaBuf = serializeReaderSchema(ctx.readSchema)
  const result = await db.server.getQueryBuf(ctx.query)
  console.log(result.byteLength)

  const obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  // console.dir(obj, { depth: 10 })

  await wait(1000)

  // RETURN NULL FOR UNDEFINED

  console.log(
    'REACHED TILL END!',
    // JSON.stringify(obj).length,
    result.byteLength,
  )
})

// filter: {
//   props: {
//     flap: { ops: [{ op: '=', val: 9999 }] },
//   },
// and: {
//   props: {
//     y: { ops: [{ op: '=', val: 100 }] },
//   },
//   or: {
//     props: {
//       y: { ops: [{ op: '=', val: 3 }] },
//     },
//     or: {
//       props: {
//         y: { ops: [{ op: '=', val: 4 }] },
//       },
//     },
//   },
// },
// or: {
//   props: {
//     y: { ops: [{ op: '=', val: 670 }] },
//   },
//   or: {
//     props: {
//       y: { ops: [{ op: '=', val: 15 }] },
//     },
//   },
// },
// },

// edges: {
//   props: {
//     $level: { include: {} },
//   },
// },
// filter: {
//   edgeStrategy: EdgeStrategy.noEdge,
//   props: {
//     enum: { ops: [{ op: '=', val: 'ok' }] },
//     x: {
//       ops: [{ op: '=', val: false }],
//     },
//     // y: {
//     //   ops: [{ op: '>', val: 5 }],
//     // },
//   },
//   // edges: {
//   //   props: {
//   //     $level: {
//   //       ops: [{ op: '>', val: 100 }],
//   //     },
//   //   },
//   // },
// },
