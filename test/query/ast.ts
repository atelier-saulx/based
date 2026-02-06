import { $buffer } from '../../src/db-client/query2/result.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('query types', async (t) => {
  const db = await testDb(t, {
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
    // annoyingThings: []
  })

  db.create('soAnnoy', {
    title: 'super annoying',
    users: [userA],
  })

  const query = db
    .query2('user')
    .include(
      'isNice',
      'name',
      'friend.$rank',
      'otherUsers.$role',
      'otherUsers.name',
      'otherUsers.isNice',
    )

  const result = await query.get()

  for (const { name, isNice, otherUsers, friend } of result) {
    const $rank: number = friend.$rank
    for (const item of otherUsers) {
      const name: string = item.name
      const isNice: boolean = item.isNice
      const id: number = item.id
      const $role: string = item.$role
    }
  }
})
