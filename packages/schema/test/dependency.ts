import test from 'node:test'
import { parse } from '@based/schema'

test('dependancy', () => {
  parse({
    locales: {
      en: {},
    },
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
