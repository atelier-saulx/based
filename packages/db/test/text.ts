import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test.skip('text', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  // db.putSchema({
  //   locales: {
  //     en: { },
  //     it: { fallback: ['en'] },
  //     fi: { fallback: ['en'] },
  //   },
  //   types: {
  //     dialog: {
  //       props: {
  //         fun: {
  //           type: 'text',
  //         }
  //       },
  //     },
  //   },
  // })

  // db.create('dialog', {
  //   fun: { en: 'haha', it: 'ahah', fi: 'hehe' },
  // })
  // db.drain()

  // console.log((await db.query('dialog').get()).toObject())
})
