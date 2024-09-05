import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('set', () => {
  parse({
    props: {
      myStrings: {
        items: {
          type: 'string',
        },
      },
    },
  })

  parse({
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

  parse({
    props: {
      myBools: {
        items: {
          type: 'boolean',
        },
      },
    },
  })

  parse({
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

  // parse({
  //   props: {
  //     myRefs: {
  //       items: {
  //         ref: 'user'
  //       },
  //     },
  //   },
  // })

  throws(() => {
    parse({
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
