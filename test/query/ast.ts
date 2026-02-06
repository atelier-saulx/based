import { $buffer } from '../../src/db-client/query2/result.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('query types', async (t) => {
  const db = await testDb(t, {
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
  })

  const userA = db.create('user', {
    isNice: true,
    textField: {
      nl: 'mijn text',
      en: 'my text',
    },
    // annoyingThings: []
  })

  db.create('soAnnoy', {
    title: 'super annoying',
    users: [userA],
  })

  const query = db
    .query2('user')
    .include('isNice', 'name', 'otherUsers', 'textField', 'friend')

  const result = await query.get()

  for (const { name, isNice, otherUsers, friend } of result) {
    const friendName = friend?.name
    for (const item of otherUsers) {
      const name: string = item.name
      const isNice: boolean = item.isNice
      const id: number = item.id
      const textField: { nl: string; en: string } = item.textField
    }
  }
})
