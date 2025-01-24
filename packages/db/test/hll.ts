import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test.skip('hll', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      article: {
        myUniqueValuesCount: 'hll',
      },
    },
  })

  // await setTimeout(100)

  console.log('------- create --------')

  const myArticle = await db.create('article', {
    myUniqueValuesCount: ['myCoolValue'],
  })

  // console.log('------- update --------')

  // // db.update('article', myArticle, {
  // //   myUniqueValuesCount: {
  // //     delete: ['myCoolValue'],
  // //   },
  // // })

  console.log('---------------')

  // console.log((await db.query('article').get()).toObject())
})
