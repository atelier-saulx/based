import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('boolean', () => {
  parseSchema({
    props: {
      myBoolean: {
        type: 'boolean',
        defaultValue: true,
      },
    },
  })

  throws(() => {
    parseSchema({
      props: {
        // @ts-ignore
        myBoolean: {
          type: 'boolean',
          defaultValue: 'hello',
        },
      },
    })
  }, 'only allow booleans')
})

// test('boolean - modify', () => {
//   update({
//     myBoolean: true
//   }, {
//     props: {
//       myBoolean: {
//         type: 'boolean',
//         defaultValue: true,
//       },
//     },
//   })
// })

/*
const schema = {
  types: {
    thing: {
      props: {
        myBoolean: {
          type: 'boolean',
          defaultValue: true,
        },
      },
    }
  }
}

import { setSchema } from '@based/schema'
setSchema(client, schema)

client.call('db:set-schema', schema)
*/
