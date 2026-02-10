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
    variance: {
      props: ['age'],
    },
    // count: { props: 'age' }, // not implementd yet
    count: {},
  }
  const ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))
  const result = await db.server.getQueryBuf(ctx.query)
  // debugBuffer(result)

  const readSchemaBuf = await serializeReaderSchema(ctx.readSchema)

  const obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)
  // console.dir(obj, { depth: 10 })

  deepEqual(
    obj,
    {
      age: { sum: 89, stddev: 9.392668535736911, variance: 88.22222222222217 },
      balance: { sum: 1370.3 },
      count: 3,
    },
    'basic accum, no groupby, no refs',
  )

  // console.log(JSON.stringify(obj), readSchemaBuf.byteLength, result.byteLength)
})

await test('group by', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  const tripClass = ['Cupper', 'Silver', 'Gold']

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
        class: tripClass,
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
    pickup: new Date('2024-12-11T11:00-03:00'),
    dropoff: new Date('2024-12-11T11:10-03:00'),
    distance: 513.44,
    class: 'Cupper',
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
    pickup: new Date('2024-12-11T13:00-03:00'),
    dropoff: new Date('2024-12-11T13:30-03:00'),
    distance: 100.1,
    class: 'Gold',
  })

  await db.drain()

  let ast: any
  let ctx: any
  let result: any
  let readSchemaBuf: any
  let obj: any

  // ---------------  Group By string key ---------------  //

  ast = {
    type: 'trip',
    sum: {
      props: ['distance'],
    },
    groupBy: {
      prop: 'vendorName',
    },
  } as QueryAst
  ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))
  result = await db.server.getQueryBuf(ctx.query)
  // debugBuffer(result)

  readSchemaBuf = await serializeReaderSchema(ctx.readSchema)

  obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  // console.dir(obj, { depth: 10 })
  deepEqual(
    obj,
    { 'Derp taxis': { distance: { sum: 613.5400000000001 } } },
    'Group By string key',
  ) // TODO: rounding check

  // ---------------  Group By numeric key ---------------  //
  ast = {
    type: 'trip',
    sum: {
      props: ['distance'],
    },
    count: {},
    groupBy: {
      prop: 'vendorIduint32',
    },
  }
  ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))
  result = await db.server.getQueryBuf(ctx.query)

  readSchemaBuf = await serializeReaderSchema(ctx.readSchema)

  obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  deepEqual(
    obj,
    { '813': { count: 2, distance: { sum: 613.5400000000001 } } },
    'Group By numeric key',
  )

  // ---------------  Group By named interval ---------------  //

  const dtFormat = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })

  ast = {
    type: 'trip',
    sum: {
      props: ['distance'],
    },
    count: {},
    groupBy: {
      prop: 'pickup',
      step: 'day',
      timeFormat: dtFormat,
      timeZone: 'America/Sao_Paulo',
    },
  } as QueryAst
  ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))
  result = await db.server.getQueryBuf(ctx.query)

  readSchemaBuf = await serializeReaderSchema(ctx.readSchema)

  obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  deepEqual(
    obj,
    { '11': { count: 2, distance: { sum: 613.5400000000001 } } },
    'Group By named interval',
  )

  // ---------------  Group By range interval with output format ---------------  //
  ast = {
    type: 'trip',
    sum: {
      props: ['distance'],
    },
    count: {},
    groupBy: {
      prop: 'pickup',
      step: 2.5 * 60 * 60, // 2:30h = 2.5 * 3600s
      display: dtFormat,
      timeZone: 'America/Sao_Paulo',
    },
  } as QueryAst
  ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))
  result = await db.server.getQueryBuf(ctx.query)

  readSchemaBuf = await serializeReaderSchema(ctx.readSchema)

  obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  deepEqual(
    obj,
    {
      '11/12/2024 11:00 – 13:30': {
        count: 2,
        distance: { sum: 613.5400000000001 },
      },
    },
    'Group By range interval with output format',
  )

  // ---------------  Group By enum keys ---------------  //

  ast = {
    type: 'trip',
    sum: {
      props: ['distance'],
    },
    count: {},
    groupBy: {
      prop: 'class',
    },
  } as QueryAst
  ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))
  result = await db.server.getQueryBuf(ctx.query)

  readSchemaBuf = await serializeReaderSchema(ctx.readSchema)

  obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  deepEqual(
    obj,
    {
      Cupper: { count: 1, distance: { sum: 513.44 } },
      Gold: { count: 1, distance: { sum: 100.1 } },
    },
    'Group By enum keys',
  )

  // console.log('🙈🙈🙈 ------------------------------- 🙈🙈🙈')

  // const r = await db
  //   .query('trip')
  //   // .count()
  //   .sum('distance')
  //   .groupBy('class', {})
  //   .get()

  // r.debug()
  // console.dir(r.toObject(), { depth: 10 })
})
