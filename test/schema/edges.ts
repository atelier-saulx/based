import { deepEqual, test } from '../shared/index.js'
import { parse } from '@based/sdk'

await test('edges', async () => {
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
