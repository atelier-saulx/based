import test from 'ava'
import { BasedSchema, setWalker2, walk } from '../src/index'

test.only('klyle set walker', async (t) => {
  const schema: BasedSchema = {
    types: {
      bla: {
        prefix: 'bl',
        fields: {
          aNumber: {
            type: 'number',
            maximum: 10,
          },
          aInteger: {
            type: 'integer',
            maximum: 10,
            exclusiveMaximum: true,
          },
          date: {
            type: 'timestamp',
          },
        },
      },
    },
    $defs: {},
    languages: ['en'],
    root: {
      fields: {},
    },
    prefixToTypeMapping: {
      bl: 'bla',
    },
  }

  const x = await setWalker2(schema, {
    $id: 'bl1',
    aInteger: { $increment: 7 },
    // date: 'now',
  })

  console.info('------------', x)

  t.true(true)
})
