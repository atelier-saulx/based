import { QueryAst } from '../../src/db-query/ast/ast.js'
import { astToQueryCtx } from '../../src/db-query/ast/toCtx.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'
import { BasedDb, debugBuffer } from '../../src/sdk.js'
import {
  resultToObject,
  serializeReaderSchema,
} from '../../src/protocol/index.js'
import { deepEqual } from 'assert'

import test from '../shared/test.js'

await test('basic', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  // const client = await testDb(t, {
  const client = await db.setSchema({
    types: {
      user: {
        age: 'uint8',
        balance: 'number',
      },
    },
  })

  const a = client.create('user', {
    age: 18,
    balance: -130.2,
  })
  const b = client.create('user', {
    age: 30,
    balance: 0,
  })
  const c = client.create('user', {
    age: 41,
    balance: 1500.5,
  })

  await db.drain()
  const ast: QueryAst = {
    type: 'user',
    sum: {
      props: ['age', 'balance'],
    },
    stddev: {
      props: ['age'],
      samplingMode: 'population',
    },
    var: {
      props: ['age'],
    },
    // count: { props: 'age' }, // not implementd yet
    count: {},
  }
  const ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))
  const result = await db.server.getQueryBuf(ctx.query)
  debugBuffer(result)

  const readSchemaBuf = await serializeReaderSchema(ctx.readSchema)

  const obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  deepEqual(
    obj,
    {
      age: { sum: 89, stddev: 9.392668535736911, variance: 88.22222222222217 },
      balance: { sum: 1370.3 },
      count: 3,
    },
    'basic accum, no groupby, no refs',
  )

  // console.dir(obj, { depth: 10 })

  console.log(JSON.stringify(obj), readSchemaBuf.byteLength, result.byteLength)

  // console.log('🙈🙈🙈 ------------------------------- 🙈🙈🙈')

  // const r = await db.query('user').count().sum('age').get()
  // r.debug()
  // r.inspect(10)
})

await test('group by', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  const client = await db.setSchema({
    types: {
      trip: {
        pickup: 'timestamp',
        dropoff: 'timestamp',
        distance: 'number',
        vendorIduint8: 'uint8',
        vendorIdint8: 'int8',
        vendorIduint16: 'uint16',
        vendorIdint16: 'int16',
        vendorIduint32: 'int32',
        vendorIdint32: 'int32',
        vendorIdnumber: 'number',
        vendorName: 'string',
      },
    },
  })

  db.create('trip', {
    vendorIduint8: 13,
    vendorIdint8: 13,
    vendorIduint16: 813,
    vendorIdint16: 813,
    vendorIduint32: 813,
    vendorIdint32: 813,
    vendorIdnumber: 813.813,
    vendorName: 'Derp taxis',
    pickup: new Date('11/12/2024 11:00'),
    dropoff: new Date('11/12/2024 11:10'),
    distance: 513.44,
  })

  await db.drain()
  const ast: QueryAst = {
    type: 'trip',
    sum: {
      props: ['distance'],
    },
    // count: {},
    groupBy: {
      prop: 'vendorName',
      // step?: number | IntervalString
      // timeZone?: string
      // timeFormat?: Intl.DateTimeFormat
    },
  }
  // const ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))
  // const result = await db.server.getQueryBuf(ctx.query)
  // debugBuffer(result)

  // const readSchemaBuf = await serializeReaderSchema(ctx.readSchema)

  // const obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  // console.dir(obj, { depth: 10 })

  console.log('🙈🙈🙈 ------------------------------- 🙈🙈🙈')

  const r = await db
    .query('trip')
    // .count()
    .sum('distance')
    .groupBy('vendorName')
    .get()
  r.debug()
  r.inspect(10)
})
