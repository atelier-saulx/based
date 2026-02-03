import { getTypeDefs } from '../../dist/schema/defs/getTypeDefs.js'
import { QueryAst } from '../../src/db-query/ast/ast.js'
import { astToQueryCtx } from '../../src/db-query/ast/toCtx.js'
import {
  resultToObject,
  serializeReaderSchema,
} from '../../src/protocol/index.js'
import { BasedDb, debugBuffer } from '../../src/sdk.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'
import { testDb } from '../shared/index.js'

import test from '../shared/test.js'

await test('aggregate', async (t) => {
  const client = await testDb(t, {
    types: {
      user: {
        age: 'uint8',
      },
    },
  })

  const a = client.create('user', {
    age: 18,
  })
})
