import test from 'node:test'
import { parse } from '@based/schema'
import { throws } from 'node:assert'

test('dependency', () => {
  parse({
    types: {
      user: {
        name: 'string',
      },
      file: {
        owner: {
          ref: 'user',
          prop: 'uploadedFiles',
          dependent: true, // <==== if there is no reference assigned, this item will be deleted
        },
      },
    },
  })
})
