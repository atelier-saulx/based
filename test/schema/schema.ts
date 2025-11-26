import { test, throws } from '../shared/index.js'
import { parse } from '@based/sdk'

await test('schema', async () => {
  parse({
    types: {},
  })

  throws(async () => {
    parse({
      types: {},
      // @ts-expect-error
      unknownTsIgnoredField: true,
    })
  }, 'Should throw with unknown fields')
})
