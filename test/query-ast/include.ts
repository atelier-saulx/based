import { registerQuery } from '../../src/db-client/query/registerQuery.js'
import { QueryAst } from '../../src/db-query/ast.js'
import { queryAstToByteCode } from '../../src/db-query/toByteCode/toByteCode.js'
import { parseSchema, Schema } from '../../src/schema.js'
import { BasedDb, debugBuffer } from '../../src/sdk.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'
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
  })
  client.create('user', {
    name: 'mr y',
    cook: {
      cookie: 1234,
    },
    mrFriend: { id: a, $level: 67 },
  })

  await db.drain()

  console.log('-------')

  let d = Date.now()

  const buf = new AutoSizedUint8Array(1000)

  let astB: Uint8Array = new Uint8Array()
  for (let i = 0; i < 1; i++) {
    // registerQuery(db.query('user').include('name', 'x', 'y'))
    astB = queryAstToByteCode(
      client.schema!,
      {
        type: 'user',
        props: {
          // name: { include: {} },
          // y: { include: {} },
          // x: { include: {} },
          // cook: {
          //   props: {
          //     cookie: { include: {} },
          //   },
          // },
          mrFriend: {
            // props: {
            //   name: { include: {} },
            // },
            edges: {
              props: {
                $level: { include: {} },
              },
            },
          },
        },
      },
      buf,
    )
  }
  console.log(Date.now() - d, 'ms')

  debugBuffer(astB)

  // console.log('--------------')
  debugBuffer(await db.server.getQueryBuf(astB))
})
