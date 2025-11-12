import test from 'node:test'
import { parse } from '@based/schema'
import { deepEqual } from 'assert'

await test('edges', () => {
  try {
    const { schema } = parse({
      types: {
        dude: {},
        user: {
          friend: {
            ref: 'dude',
            prop: 'friend',
            $nerds: 'boolean',
            $option: ['cool', 'dazzling'],
          },
          friends: {
            items: {
              ref: 'dude',
              prop: 'friends',
              $nerds: 'boolean',
            },
          },
        },
      },
    })

    deepEqual(schema, {
      types: {
        dude: {
          props: {
            friend: {
              items: {
                ref: 'user',
                prop: 'friend',
                $nerds: { type: 'boolean' },
                $option: { enum: ['cool', 'dazzling'] },
              },
            },
            friends: {
              items: {
                ref: 'user',
                prop: 'friends',
                $nerds: { type: 'boolean' },
              },
            },
          },
        },
        user: {
          props: {
            friend: {
              ref: 'dude',
              prop: 'friend',
              $nerds: { type: 'boolean' },
              $option: { enum: ['cool', 'dazzling'] },
            },
            friends: {
              items: {
                ref: 'dude',
                prop: 'friends',
                $nerds: { type: 'boolean' },
              },
            },
          },
        },
      },
    })
  } catch (e) {
    console.error(e)
  }
})
