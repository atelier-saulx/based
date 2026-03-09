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
    const tests = new Promise<void>((resolve) =>
      db
        .query('user', john)
        .include('name')
        .subscribe(async (res) => {
          // console.log(res)
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
    // console.dir(results)
  }

  // const res = await db
  //   .query('user', { nickname: 'masterchief' })
  //   .include('name')
  //   .get()

  //   // what to do with alias
  // console.dir({ res }, { depth: null })

  {
    const results: any[] = []
    const tests = new Promise<void>((resolve) =>
      db
        .query('user', { nickname: 'masterchief' })
        .include('name')
        .subscribe(async (res) => {
          console.log(res)
          const count = results.push(res)
          if (count === 1) {
            await db.upsert(
              'user',
              { nickname: 'masterchief' },
              {
                name: 'bon jon',
                // age: 19,
              },
            )
          } else {
            resolve()
          }
        }),
    )

    await tests
    console.dir(results)
  }

  // deepEqual(results, [
  //   {
  //     id: 1,
  //     name: 'john',
  //     age: 0,
  //   },
  //   {
  //     id: 1,
  //     name: 'bob',
  //     age: 0,
  //   },
  // ])
})
