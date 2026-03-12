import { QueryAst } from '../../src/db-query/ast/ast.js'
import { astToQueryCtx } from '../../src/db-query/ast/toCtx.js'
import { resultToObject } from '../../src/protocol/index.js'
import { debugBuffer, type SchemaIn } from '../../src/sdk.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'
import { writeUint32 } from '../../src/utils/uint8.js'
import wait from '../../src/utils/wait.js'
import { perf } from '../shared/perf.js'
import test, { T } from '../shared/test.js'
import { deflateSync } from 'zlib'
import { fastPrng } from '../../src/utils/fastPrng.js'
import { testDbClient, testDbServer } from '../shared/index.js'
import { alias } from '../../src/schema/defs/props/alias.js'
import { FilterType } from '../../src/zigTsExports.js'

await test('include', async (t) => {
  const server = await testDbServer(t, { noBackup: true })
  const schema = {
    locales: {
      en: true,
      nl: { fallback: ['en'] },
      fi: { fallback: ['en', 'nl'] },
    },
    // locales: ['nl', 'en', 'fr', 'aa', 'ab', 'el', 'fi', 'pt'],
    types: {
      friend: {
        y: 'uint32',
      },
      user: {
        aliasId: 'alias',
        name: 'string',
        big: { type: 'string', compression: 'none' },
        localized: {
          type: 'string',
          localized: true,
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
        // ----------------------------
        derp: { type: 'string', maxBytes: 64 },
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
      },
    },
  } as const
  const client = await testDbClient(server, schema)

  let syntheticData = ''

  // for (let i = 0; i < 125e3; i++) {
  //   syntheticData += 'ab'
  // }

  for (let i = 0; i < 200; i++) {
    syntheticData += 'ab '
  }

  // syntheticData = italy

  // syntheticData = 'my snurfelbag my snurfelBag my snurfelbag my snurfelbag'

  const a = client.create('user', {
    // name: 'mr jim',
    localized: {
      en: 'mr jim EN',
      nl: 'derpi yuz NL',
    },
    aliasId: 'jim',
    derp: 'aaaaa',
    // enum: 'ok',
    // derp: 'aa',
    // big: 'mr jim',
    y: 15,
    // x: false,
    // flap: 9999,
    // cook: {
    //   cookie: 1234,
    // },
  })

  const b = await client.create('user', {
    name: 'mr snurf b',
    localized: {
      en: 'MR B ENG',
    },
    derp: 'aaaaa',
    aliasId: 'snurf',
    y: 15,
    x: true,
    big: 'mr giraffe man',
    flap: 9999,
    cook: {
      cookie: 1234,
    },
    mrFriend: { id: a, $level: 67 },
  })

  let d = Date.now()

  const rand = fastPrng()
  const ids: number[] = []
  for (let i = 0; i < 1e6; i++) {
    ids.push(i + 1)
    client.create('user', {
      // big: syntheticData,
      y: i,
      derp: 'aaaaa',

      // aliasId: `flap${i}`,
      // name: `mr snurf ${i}`,
      // localized: {
      //   nl: 'giraffe NL',
      // },
      // derp: 'cc',
      // y: i,
      // x: !!(i % 2),
      // enum: i % 2 ? 'great' : null,
      // flap: 9999,
      // cook: {
      //   cookie: 1234,
      // },
      friends: [
        { id: a, $level: rand(0, 200) },
        { id: b, $level: rand(0, 200) },
      ],
    })
  }

  // for sort 1M we can prob do better with either INDEX (scince it will refire)

  await client.drain()

  console.log('mod create done', Date.now() - d, 'ms')

  // filter: RE-ADD REFERENCE
  // filter: REFERENCES

  // GET REFERENCEs
  // SORT REFERENCES
  // FILTER REFENRRENS
  // FILTER REFS BY EDGE
  // ALIAS

  // const bigArray: string[] = []
  // for (let i = 0; i < 1e3; i++) {
  //   bigArray.push(i % 2 ? 'xy' : 'xx')
  // }

  const ast: QueryAst = {
    type: 'user',
    // target: ids,
    // locale: 'fi',
    range: { start: 0, end: 1e6 },
    filter: {
      props: {
        derp: {
          ops: [
            {
              op: '!includes',
              val: 'aaXYXfkowenfewknfwoefnqeoifnqeroifewoibfneqo feoirfh wrorighxxaa',
            },
          ],
        },
        y: {
          ops: [{ op: '=', val: [1, 2, 15, 1, 2, 15] }],
        },
        // derp: {
        //   ops: [
        //     // { op: 'includes', val: 'aaaa' },
        //     { op: '!includes', val: 'a' },

        //     // { op: '=', val: 'aaaaa' },

        //     // { op: '=', val: 'bad' },
        //   ],
        // },
        // enum: {
        //   ops: [
        //     { op: '=', val: null },
        //     // { op: '=', val: 'bad' },
        //   ],
        // },
      },
    },

    props: {
      y: { include: {} },
      name: { include: {} },
      // friends: {
      //   props: {
      //     y: { include: {} },
      //     name: { include: {} },
      //   },
      //   edges: {
      //     props: {
      //       $level: { include: {} },
      //     },
      //   },
      //   sort: { prop: '$level' },
      //   order: 'asc',
      //   range: { start: 0, end: 1e6 },
      //   filter: {
      //     filterType: FilterType.edgeAndProps,
      //     edges: {
      //       props: {
      //         $level: {
      //           ops: [{ op: '>', val: [0] }],
      //         },
      //       },
      //     },
      //     // props: {
      //     //   enum: {
      //     //     ops: [
      //     //       { op: '=', val: 'ok' },
      //     //       { op: '=', val: 'bad' },
      //     //     ],
      //     //   },
      //     //   y: {
      //     //     ops: [
      //     //       { op: '=', val: 10 },
      //     //       { op: '=', val: [15, 100, 200, 300] },
      //     //     ],
      //     //   },
      //     // },
      //   },
      // },
      // localized: {
      //   // include: {
      //   //   meta: 'only', // few empty
      //   //   // maxChars: 6,
      //   // },
      //   props: {
      //     fi: {
      //       include: {},
      //     },
      //     nl: {
      //       include: {
      //         meta: 'only',
      //         // meta
      //       },
      //     },
      //     en: {
      //       include: {
      //         maxChars: 6,
      //         meta: true,
      //         // maxChars: 4,
      //         // meta
      //       },
      //     },
      //   },
      // },
    },
  }

  console.dir(ast, { depth: 10 })

  const ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))

  console.log(deflateSync(ctx.query).byteLength, '/', ctx.query.byteLength)

  // debugBuffer(ctx.query)

  // debugBuffer(deflateSync(ctx.query).toString('base64'))

  const queries: any = []
  for (let i = 0; i < 10; i++) {
    const x = ctx.query.slice(0)
    writeUint32(x, i + 1, 0)
    queries.push(x)
  }

  console.log('START PERF', Date.now() - d, 'ms')
  const sizes: Set<number> = new Set()
  await perf(
    async () => {
      const q: any = []
      for (let i = 0; i < 5; i++) {
        q.push(server.getQueryBuf(queries[i]))
      }
      const x = await Promise.all(q)
      x.forEach((v) => sizes.add(v.byteLength))
      // console.log(x)
    },
    'filter speed (5 cores) 25M / scan',
    {
      repeat: 10,
    },
  )

  console.log(' PERF DONE', Date.now() - d, 'ms')

  // const readSchemaBuf = serializeReaderSchema(ctx.readSchema)
  const result = await server.getQueryBuf(ctx.query)
  console.log(result.byteLength)

  const obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  console.dir(obj, { depth: 10 })

  await wait(1000)

  // RETURN NULL FOR UNDEFINED

  console.log(
    'REACHED TILL END!',
    // JSON.stringify(obj).length,
    result.byteLength,
    sizes,
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
