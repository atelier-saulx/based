import { test } from '../shared/index.js'
import { parse } from '@based/sdk'

await test('dependency', async () => {
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
