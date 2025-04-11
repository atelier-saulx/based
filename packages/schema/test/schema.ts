import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('schema', () => {
  parse({
    props: {},
    types: {},
  })

  await throws(() => {
    parse({
      props: {},
      types: {},
      // @ts-ignore
      unknownTsIgnoredField: true,
    })
  }, 'Should throw with unknown fields')
})
