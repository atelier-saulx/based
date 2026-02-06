import { BasedTestDb, testDb } from '../../test/shared/index.js'

const schema = {
  locales: {
    en: true,
    nl: true,
  },
  types: {
    soAnnoy: {
      title: 'string',
      users: {
        items: {
          ref: 'user',
          prop: 'annoyingThings',
          $validEdge: 'boolean',
        },
      },
    },
    user: {
      name: 'string',
      isNice: 'boolean',
      textField: 'text',
      friend: {
        ref: 'user',
        prop: 'friend',
        $rank: 'number',
      },
      otherUsers: {
        items: {
          ref: 'user',
          prop: 'otherUsers',
          $role: 'string',
        },
      },
    },
  },
} as const

// Simulated usage
async function run() {
  const t = { after: () => {}, tmp: './tmp' }
  const db: BasedTestDb<typeof schema> = await testDb(t, schema)
  // Inspect this function signature via d.ts
  checkTypes(db)
}

export function checkTypes(db: BasedTestDb<typeof schema>) {
  const userA = db.create('user', {
    isNice: true,
    textField: {
      nl: 'mijn text',
      en: 'my text',
    },
    annoyingThings: [
      {
        id: 2,
        // @ts-expect-error
        $invalidEdge: true, // Should error
        $validEdge: true,
      },
      {
        id: 3,
        // correct
      },
    ],
  })
}
