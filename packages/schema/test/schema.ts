import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('schema', () => {
  parseSchema({
    props: {},
    types: {},
  })

  throws(() => {
    parseSchema({
      props: {},
      types: {},
      // @ts-ignore
      unknownTsIgnoredField: true,
    })
  }, 'Should throw with unknown fields')
})
