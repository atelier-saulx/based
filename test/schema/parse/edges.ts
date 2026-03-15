import { deepEqual, test } from '../../shared/index.js'
import { parse } from '@based/sdk'
import { testDbClient, testDbServer } from '../../shared/index.js'

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
                //@ts-ignore
                $option: { enum: ['cool', 'dazzling'] },
              },
            },
            friends: {
              //@ts-ignore
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
              //@ts-ignore
              $option: { enum: ['cool', 'dazzling'] },
            },
            friends: {
              //@ts-ignore
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

await test('schema edges', async (t) => {
  const server = await testDbServer(t)
  const client = await testDbClient(server)

  try {
    await client.setSchema({
      types: {
        role: {
          name: 'string',
          rank: 'uint8',
        },
        player: {
          name: 'string',
          games: {
            items: {
              ref: 'game',
              prop: 'players',
              $roles: {
                items: {
                  ref: 'role',
                },
              },
            },
          },
        },
        game: {
          name: 'string',
        },
      },
    })
  } catch (e) {
    console.error(e)
  }

  try {
    await client.setSchema({
      types: {
        role: {
          name: 'string',
          rank: 'uint8',
        },
        game: {
          name: 'string',
        },
        player: {
          name: 'string',
          games: {
            items: {
              ref: 'game',
              prop: 'players',
              $roles: {
                items: {
                  ref: 'role',
                },
              },
            },
          },
        },
      },
    })
  } catch (e) {
    console.error(e)
  }

  try {
    await client.setSchema({
      types: {
        player: {
          name: 'string',
          games: {
            items: {
              ref: 'game',
              prop: 'players',
              $roles: {
                items: {
                  ref: 'role',
                },
              },
            },
          },
        },
        role: {
          name: 'string',
          rank: 'uint8',
        },
        game: {
          name: 'string',
          players: {
            items: {
              ref: 'player',
              prop: 'games',
              $roles: {
                items: {
                  ref: 'role',
                },
              },
            },
          },
        },
        thing: {
          games: {
            items: {
              ref: 'game',
              prop: 'things',
              $role: {
                ref: 'role',
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
