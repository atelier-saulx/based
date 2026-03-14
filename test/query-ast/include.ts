import { QueryAst } from '../../src/db-query/ast/ast.js'
import { astToQueryCtx } from '../../src/db-query/ast/toCtx.js'
import {
  resultToObject,
  serializeReadSchema,
  deSerializeSchema,
} from '../../src/protocol/index.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'
import { writeUint32 } from '../../src/utils/uint8.js'
import wait from '../../src/utils/wait.js'
import { perf } from '../shared/perf.js'
import test, { T } from '../shared/test.js'
import { deflateSync } from 'zlib'
import { fastPrng } from '../../src/utils/fastPrng.js'
import { deepEqual, testDbClient, testDbServer } from '../shared/index.js'
import { FilterType } from '../../src/zigTsExports.js'
// import { deserialize } from 'v8' super nice to use

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
            $level: 'string',
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

  for (let i = 0; i < 200; i++) {
    syntheticData += 'ab '
  }

  const a = client.create('user', {
    localized: {
      en: 'mr jim EN',
      nl: 'derpi yuz NL',
    },
    aliasId: 'jim',
    derp: 'aaaaa',
    y: 15,
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
    mrFriend: { id: a },
  })

  let d = Date.now()

  const rand = fastPrng()
  // const ids: number[] = []
  for (let i = 0; i < 3; i++) {
    // ids.push(i + 1)
    client.create('user', {
      y: i,
      aliasId: '#' + i,
      derp: 'aaaaa',
      friends: [a, { id: b, $level: rand(0, 200) + '' }],
    })
  }

  await client.drain()

  const ast: QueryAst = {
    type: 'user',
    range: { start: 0, end: 1e6 },
    filter: {
      // mixed can now be made have to handle in filter
      // we can also just pass null for edge and keep it rly simple
      // also pass null edgeType
      // filterType: FilterType.propOnly,
      props: {
        y: { ops: [{ op: '=', val: [2] }] },
        id: { ops: [{ op: '>', val: [0] }] },
        aliasId: { ops: [{ op: '=', val: ['#2'] }] },
      },
    },
    props: {
      y: { include: {} },
      // '*': { include: {} }, // combining these has to work
      friends: {
        props: {
          y: { include: {} },
        },
        edges: {
          props: {
            $level: { include: { meta: true } },
          },
        },
        // filter: {
        //   // mixed can now be made have to handle in filter
        //   // we can also just pass null for edge and keep it rly simple
        //   // also pass null edgeType
        //   // filterType: FilterType.edgeFilter,
        //   props: {
        //     y: { ops: [{ op: '=', val: [15] }] },
        //   },
        //   edges: {
        //     props: {
        //       $level: { ops: [{ op: 'includes', val: '67' }] },
        //     },
        //     or: {
        //       props: {
        //         $level: { ops: [{ op: 'includes', val: '2' }] },
        //       },
        //     },
        //   },
        // },
      },
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
  await perf.skip(
    async () => {
      const q: any = []
      for (let i = 0; i < 5; i++) {
        q.push(server.getQueryBuf(queries[i]))
      }
      const x = await Promise.all(q)
      x.forEach((v) => sizes.add(v.byteLength))
    },
    'filter speed (5 cores) 25M / scan',
    {
      repeat: 10,
    },
  )

  console.log(' PERF DONE', Date.now() - d, 'ms')

  const readSchemaBuf = serializeReadSchema(ctx.readSchema)

  const result = await server.getQueryBuf(ctx.query)
  const obj = resultToObject(
    deSerializeSchema(readSchemaBuf),
    result,
    result.byteLength - 4,
  )

  console.log('BLA:')
  // console.dir(ctx.readSchema, { depth: 10 })
  // console.log('-------------------------------')
  // console.dir(deSerializeSchema(readSchemaBuf), { depth: 10 })
  console.dir(obj, { depth: 10 })

  deepEqual(obj, resultToObject(ctx.readSchema, result, result.byteLength - 4))

  await wait(1000)

  console.log('REACHED TILL END!', result.byteLength, sizes)
})
