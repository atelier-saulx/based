import test from 'node:test'
import { parse } from '@based/schema'

await test('object', () => {
  parse({
    props: {
      myObject: {
        props: {
          myField: {
            type: 'boolean',
          },
        },
      },
    },
  })
})
