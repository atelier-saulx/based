import { QueryAst } from '../../src/db-query/ast/ast.js'
import { testDb } from '../shared/index.js'
import { astToQueryCtx } from '../../src/db-query/ast/toCtx.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'
import { BasedDb, debugBuffer } from '../../src/sdk.js'
import {
  resultToObject,
  serializeReaderSchema,
} from '../../src/protocol/index.js'

import test from '../shared/test.js'

await test('aggregate', async (t) => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  // const client = await testDb(t, {
  const client = await db.setSchema({
    types: {
      user: {
        age: 'uint8',
      },
    },
  })

  const a = client.create('user', {
    age: 18,
  })
  const back = client.create('user', {
    age: 30,
  })

  const ast: QueryAst = {
    type: 'user',
    // props: {
    //   age: { include: {} },
    // },
    sum: {
      props: ['age'],
    },
  }
  const ctx = astToQueryCtx(client.schema!, ast, new AutoSizedUint8Array(1000))
  const result = await db.server.getQueryBuf(ctx.query)
  debugBuffer(result)

  const readSchemaBuf = serializeReaderSchema(ctx.readSchema)

  const obj = resultToObject(ctx.readSchema, result, result.byteLength - 4)

  console.dir(obj, { depth: 10 })

  console.log(
    JSON.stringify(obj).length,
    readSchemaBuf.byteLength + result.byteLength,
  )

  console.log('🙈🙈🙈 ------------------------------- 🙈🙈🙈')
  const r = await db.query('user').sum('age').get()
  r.debug()
  r.inspect(10)
})
