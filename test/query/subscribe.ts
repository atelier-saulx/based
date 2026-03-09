import wait from '../../src/utils/wait.js'
import { deepEqual, testDb } from '../shared/index.js'
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
        age: 'uint8',
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
  })

  const results: any[] = []
  const tests = new Promise<void>((resolve) =>
    db
      .query('user', john)
      // .include('age')
      .subscribe(async (res) => {
        console.log(res)
        const count = results.push(res)
        if (count === 1) {
          await db.update('user', john, {
            name: 'bob',
            // age: 19,
          })
        } else {
          resolve()
        }
      }),
  )

  await tests

  deepEqual(results, [
    {
      id: 1,
      name: 'john',
      age: 0,
    },
    {
      id: 1,
      name: 'bob',
      age: 0,
    },
  ])
})
