import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test.skip('idOffset', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 50000,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
    types: {
      thing: {
        props: {
          name: 'string',
          things: {
            items: {
              ref: 'thing',
              prop: 'things',
            },
          },
        },
      },
    },
  })

  const a = 10000
  const things = []
  let i = a

  // await new Promise<void>((resolve) => {
  //   let interval = setInterval(async () => {
  //     if (i--) {
  //       things.push(
  //         await db.create('thing', { name: 'thing ' + (a - i), things }),
  //       )
  //     } else {
  //       clearInterval(interval)
  //       clearInterval(interval2)
  //       resolve()
  //     }
  //   })
  //   let interval2 = setInterval(async () => {
  //     if (i--) {
  //       db.query('thing').include('things').get()
  //     } else {
  //       clearInterval(interval)
  //       clearInterval(interval2)
  //       resolve()
  //     }
  //   })
  // })
})
