import { parse, type Schema } from './index.js'

parse({
  types: {
    youzi: {
      type: 'string',
    },
    barp: {
      props: {
        name: 'string1',
        foo: {
          ref: 'user1',
          prop: 'snurk1',
        },
      },
    },
  },
})
