import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('set', () => {
  parseSchema({
    props: {
      myStrings: {
        items: {
          type: 'string',
        },
      },
    },
  })

  parseSchema({
    props: {
      myNumbers: {
        items: {
          type: 'number',
          min: 0,
          max: 100,
          step: 1,
        },
      },
    },
  })

  parseSchema({
    props: {
      myBools: {
        items: {
          type: 'boolean',
        },
      },
    },
  })

  parseSchema({
    types: {
      user: {
        props: {
          name: {
            type: 'string',
          },
        },
      },
    },
    props: {
      myUsers: {
        items: {
          ref: 'user',
        },
      },
    },
  })

  // parseSchema({
  //   props: {
  //     myRefs: {
  //       items: {
  //         ref: 'user'
  //       },
  //     },
  //   },
  // })

  throws(() => {
    parseSchema({
      types: {
        myType: {
          props: {
            // @ts-ignore
            myWrongSet: {
              type: 'set',
            },
          },
        },
      },
    })
  }, 'Should throw for set without items')
})
