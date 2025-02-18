import { BasedDb, xxHash64 } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from 'node:assert'

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
        derp: 'number',
        count: 'cardinality',
      },
    },
  })

  await db.create('article', {
    count: [
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
    derp: 1,
  })

  let myArticle = await db.create('article', {
    count: 'myCoolValue',
    derp: 100,
  })

  await db
    .query('article')
    .sort('count', 'desc')
    .include('count')
    .get()
    .inspect()

  // funciona mesmo se eu não incluir count
  await db.query('article').sort('count', 'asc').include('derp').get().inspect()

  await db.update('article', myArticle, {
    count: 'lala',
  })

  console.log(await db.drain(), 'ms')

  await db
    .query('article')
    .sort('count', 'asc')
    .include('count')
    .get()
    .inspect()

  //   deepEqual((await db.query('article').include('count').get()).toObject(), [
  //     {
  //       id: 1,
  //       myUniqueValuesCount: 1,
  //       myUniqueValuesCountFromArray: 0,
  //     },
  //   ])
})
