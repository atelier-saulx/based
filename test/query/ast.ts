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
      'otherUsers.$role',
      'otherUsers.name',
      'otherUsers.isNice',
    )

  const result = await query.get()

  for (const { name, isNice, otherUsers } of result) {
    for (const item of otherUsers) {
      const name: string = item.name
      const isNice: boolean = item.isNice
      const id: number = item.id
      const $role: string = item.$role
    }
  }

  // .include((select) =>
  //   select('otherUsers').include('name').filter('name', '=', 'youzi'),
  // )
  // .filter('otherUsers.name', '=', 'youzi')

  // console.dir(query.ast, { depth: null })
  // const proxy = await query.get()
  // console.log('-----------', proxy)
  // proxy
  // console.log('-----------1')
  // // proxy.forEach((a, b, c) => console.log('WAZZUP', { a, b, c }))
  // for (const i of proxy) {
  //   console.log({ i })
  // }

  // console.log('-->', proxy[$buffer])
  // console.log('???', proxy)
  // console.log('WOW', proxy[0])
  // console.log('json', JSON.stringify(proxy))
  // for (const i of proxy) {
  //   console.log({ i })
  // }

  // //

  // const $result = Symbol()
  // const tmp = []
  // const proxy = new Proxy(tmp, {
  //   get(a, b) {
  //     console.log('get youzi')
  //     // @ts-ignore
  //     tmp[$result].__proto__ = { bla: true }
  //     return a[b]
  //   },
  // })

  // const result = tmp[$result] = {
  //   __proto__: proxy,
  // }

  // // @ts-ignore
  // console.log('--->', result.bla)
  // // @ts-ignore
  // console.log('--->', result.bla)
})
