import test from '../shared/test.js'
import { BasedDb } from '../../src/index.js'

await test('schema edges', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.setSchema({
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

  await db.setSchema({
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

  await db.setSchema({
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
})
