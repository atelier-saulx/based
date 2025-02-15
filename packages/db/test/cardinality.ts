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
        myUniqueValuesCountFromArray: 'cardinality',
      },
    },
  })

  console.log('------- create --------')

  const myArticle = await db.create('article', {
    myUniqueValuesCount: 'myCoolValue',
  })

  // const myArticle = await db.create('article', {
  //   myUniqueValuesCountFromArray: [
  //     'myCoolValue',
  //     'myCoolValue',
  //     'mr snurfels',
  //     'mr snurfels',
  //     'lala',
  //     'lala',
  //     'myCoolValue',
  //     'myCoolValue',
  //     'mr snurfels',
  //     'mr snurfels',
  //     'lala',
  //     'lala',
  //     'lele',
  //     'lili',
  //     'lolo',
  //     'lulu',
  //   ],
  // })

  // const felling = ['folish', 'superficial', 'deep', 'moving', 'fake']

  // let lastId = 0
  // const f: number[] = []
  // for (let i = 0; i < 1e2; i++) {
  //   lastId = db.create('article', {
  //     myUniqueValuesCount:
  //       felling[Math.floor(Math.random() * (felling.length - 1))],
  //   }).tmpId
  //   if (i % 2) {
  //     f.push(lastId)
  //   }
  // }

  // db.update('article', myArticle, {
  //   myUniqueValuesCount: f,
  // })

  // console.log(await db.drain(), 'ms')

  // console.log('------- update --------')

  await db.update('article', myArticle, {
    myUniqueValuesCount: [
      'myCoolValue',
      'myCoolValue',
      'mr snurfels',
      'mr snurfels',
      'lala',
      'lala',
      'myCoolValue',
      'myCoolValue',
      'mr snurfels',
      'mr snurfels',
      'lala',
      'lala',
      'lele',
      'lili',
      'lolo',
      'lulu',
    ],
  })

  // for (let i = 0; i < 1e1; i++) {
  //   await db.update('article', myArticle, {
  //     myUniqueValuesCount: `lala${i}`,
  //   })
  // }
  // await db.drain()

  console.log('---------------')

  // console.log((await db.query('article').get()).toObject())
})
