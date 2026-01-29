import { QueryAst } from '../../src/db-query/ast.js'
import { queryAstToByteCode } from '../../src/db-query/toByteCode/toByteCode.js'
import { parseSchema, Schema } from '../../src/schema.js'
import { debugBuffer } from '../../src/sdk.js'

import test from '../shared/test.js'

await test('include', async (t) => {
  const schema: Schema = {
    types: {
      user: {
        name: 'string',
      },
    },
  }

  const strictSchema = parseSchema(schema)

  const buf = queryAstToByteCode(strictSchema, {
    type: 'user',
    props: {
      name: { include: {} },
    },
  })

  debugBuffer(buf)
})
