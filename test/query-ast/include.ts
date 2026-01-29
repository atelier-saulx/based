import { deSerializeSchema } from '../../dist/protocol/db-read/schema/deserialize.js'
import { convertToReaderSchema } from '../../src/db-client/query/queryDefToReadSchema.js'
import { registerQuery } from '../../src/db-client/query/registerQuery.js'
import { QueryAst } from '../../src/db-query/ast.js'
import { queryAstToReadSchema } from '../../src/db-query/readSchema/astToReadSchema.js'
import { queryAstToByteCode } from '../../src/db-query/toByteCode/astToByteCode.js'
import {
  resultToObject,
  serializeReaderSchema,
} from '../../src/protocol/index.js'
import { parseSchema, Schema } from '../../src/schema.js'
import { BasedDb, debugBuffer } from '../../src/sdk.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'
import deepEqual from '../../src/utils/deepEqual.js'
import { testDb } from '../shared/index.js'

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

  const buf = new AutoSizedUint8Array(1000)

  let astB: Uint8Array = new Uint8Array()

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

  const readSchema = queryAstToReadSchema(client.schema!, ast)

  const bufS = serializeReaderSchema(readSchema)

  console.log(readSchema, bufS)

  console.log('derp')

  for (let i = 0; i < 1; i++) {
    // registerQuery(db.query('user').include('name', 'x', 'y'))
    astB = queryAstToByteCode(client.schema!, ast, buf)
  }
  console.log(Date.now() - d, 'ms')

  debugBuffer(astB)

  // console.log('--------------')
  const result = await db.server.getQueryBuf(astB)
  debugBuffer(result)

  const x = deSerializeSchema(bufS, 0)

  const yyy = db.query('user').include('name')
  const xxxx = registerQuery(yyy)

  const x2 = convertToReaderSchema(yyy.def!)

  console.dir({ x }, { depth: 10 })

  console.dir(x2, { depth: 10 })

  // console.log('====', deepEqual(x, x2))

  console.log(resultToObject(x, result, result.byteLength - 4))
})
