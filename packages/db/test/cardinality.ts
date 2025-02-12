import { skip } from 'node:test'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('hll', async (t) => {
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
        myUniqueValuesCount: 'cardinality',
      },
    },
  })

  // await setTimeout(100)

  console.log('------- create --------')

  const myArticle = await db.create('article', {
    myUniqueValuesCount: 'myCoolValue', //['myCoolValue', 'mr snurfels'], // testar depois com valor que não é array
  })

  console.log('------- update --------')

  // await db.update('article', myArticle, {
  //   myUniqueValuesCount: {
  //     add: ['myCoolValue'],
  //   },
  // })

  console.log('---------------')

  // console.log((await db.query('article').get()).toObject())
})
