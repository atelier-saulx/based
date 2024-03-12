import { BasedSchema } from '@based/schema'

export const DEFAULT_SCHEMA: BasedSchema = {
  $defs: {},
  language: 'en',
  prefixToTypeMapping: {
    ro: 'root',
  },
  types: {},
  root: {
    fields: {
      schema: {
        type: 'json',
      },
      id: { type: 'string' },
      type: { type: 'string' },
      children: { type: 'references' },
      descendants: { type: 'references' },
      aliases: {
        type: 'set',
        items: { type: 'string' },
      },
    },
  },
}
