import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { setTimeout } from 'node:timers/promises'

await test.skip('history', async (t) => {
  const db = new BasedDb({ path: t.tmp })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  await db.putSchema({
    types: {
      page: {
        props: {
          name: 'string',
          views: {
            type: 'uint32',
          },
          active: {
            type: 'uint32',
          },
        },
        // history: {
        //   props: ['views', 'active'],
        //   interval: 'second',
        // },d
      },
    },
  })

  // db.

  // await db.putSchema({
  //   types: {
  //     page: {
  //       props: {
  //         name: 'string',
  //         views: {
  //           type: 'uint32',
  //           history: {
  //             interval: 'second'
  //           }
  //         },
  //         active: {
  //           type: 'uint32',
  //           history: {
  //             interval: 'second'
  //           }
  //         }
  //       },
  //     },
  //   },
  // })

  const page = await db.create('page')
  let i = 5
  let views = 0
  while (i--) {
    views++
    await db.update('page', page, { views })
    await setTimeout(1e3)
  }

  // await db.query('page', page).include('views.history')

  // await db.history('page', page).include('views').get()

  /*
  [{
    _ts: 40923740239,
    views: 1
  },
  {
    _ts: 40928040239,
    views: 2
  },
  {
    _ts: 40928040239,
    views: 3
  }]
  */
})
