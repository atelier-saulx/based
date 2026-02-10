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
      friend: {
        y: 'uint16',
      },
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

  // const b = client.create('user', {
  //   name: 'BBBBBBBBB',
  //   y: 67,
  //   x: true,
  //   flap: 9999,
  //   cook: {
  //     cookie: 1234,
  //   },
  // })

  await client.create('user', {
    name: 'CCCCCCCCC',
    cook: {
      cookie: 1234,
    },
    y: 0,
    mrFriend: { id: a, $level: 99 },
    // friends: [{ id: a, $level: 250 }, b],
  })

  await db.drain()

  console.log('-------')

  // let d = Date.now()

  const ast: QueryAst = {
    type: 'user',
    filter: {
      props: {
        // 1
        y: { ops: [{ op: '=', val: 0 }] },
        // add reference
        // add references
        // add edges
      },
      // add AND

      and: {
        // 2
        props: {
          y: { ops: [{ op: '=', val: 10 }] },
        },
        or: {
          // 3
          props: {
            y: { ops: [{ op: '=', val: 3 }] },
          },
          // 4
          or: {
            props: {
              y: { ops: [{ op: '=', val: 4 }] },
            },
          },
        },
      },

      or: {
        // 5
        props: {
          y: { ops: [{ op: '=', val: 67 }] },
        },
      },

      // (y=0 & ((y=10&x=100) | y=3 | y=4)) | y=67
      // 1:y=0
      // 2:y=10&x=100
      // 3:y=3
      // 4:y=4
      // 5:y=67
      // >5 1 >3 2 >4 3 >5 67

      // > means this is the next evaluation if it does not pass if any does not pass in the group e.g. (y=10) in 2 then its does not pass and return
    },
    props: {
      // name: { include: {} },
      y: { include: {} },
      mrFriend: {
        props: {
          y: { include: {} },
        },
        edges: {
          props: {
            $level: { include: {} },
          },
        },
      },

      // y=4

      //   // EDGE

      //   edges: {
      //     props: {
      //       $level: { include: {} },
      //     },
      //   },
      // },
      // fix friends
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

  // single ref edge filter
  // sort
  // variable filters

  // in js
  // meta include, text include (localized: true)

  const ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))

  // TODO

  // const bla = schema({
  //   email: { type: 'string', format: 'email' },
  //   subject: { type: 'string', max: 100 },
  //   body: 'string'
  // })

  // const sendEmail = (x: bla) => {
  //   return sendgrid.sendEmail('beerdejim@gmail.com')
  // }

  // filter
  // AND + or (x.or.y).or(z)
  // reference + edge
  // refernces filters? + select
  // now parsing in filters
  // finish all operators (exist ,!nexist) how to handle for fixed?
  // var filters
  //  like
  //  references includes
  //  includes
  //. single ref or includes
  //. eq STRING crc32 this is a seperate op /w branch check /w

  // include
  // JS
  // references select
  // TEXT - make this localized true
  // meta

  // SORT in js

  // subscriptions MULTI + references
  // subscriptions in modify
  // subscription NOW reschedule
  // now parsingio

  // Based-server / client
  // ctx .get bug

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
