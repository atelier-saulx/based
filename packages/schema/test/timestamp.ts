import test from 'node:test'
import { parse } from '@based/schema'

test('timestamp', () => {
  parse({
    props: {
      myTimestamp: {
        type: 'timestamp',
      },
      created: {
        type: 'timestamp',
        on: 'create',
      },
      lastModified: {
        type: 'timestamp',
        on: 'update',
      },
    },
  })
})
