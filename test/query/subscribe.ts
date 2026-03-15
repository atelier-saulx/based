import { deepEqual } from 'assert'
import wait from '../../src/utils/wait.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('query db', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
      nl: true,
    },
    types: {
      user: {
        name: 'string',
        rank: 'uint8',
        age: 'uint8',
        nickname: 'alias',
        address: {
          props: {
            street: 'string',
          },
        },
      },
    },
  })

  const john = await db.create('user', {
    name: 'john',
    nickname: 'masterchief',
  })

  {
    const results: any[] = []
    const tests = new Promise<() => void>((resolve) => {
      const next = [
        () => db.update('user', john, { name: 'youzi' }),
        () => db.update('user', john, { name: 'bob' }),
      ]
      const close = db
        .query('user', john)
        .include('name')
        .subscribe(async (res) => {
          results.push(res)
          const cmd = next.shift()
          if (cmd) {
            cmd()
          } else {
            resolve(close)
          }
        })
    })

    const close = await tests
    close()

    db.update('user', john, { name: 'jamez' })
    deepEqual(await db.query('user', john).include('name').get(), {
      id: 1,
      name: 'jamez',
    })
    deepEqual(results, [
      { id: 1, name: 'john' },
      { id: 1, name: 'youzi' },
      { id: 1, name: 'bob' },
    ])
  }
})
