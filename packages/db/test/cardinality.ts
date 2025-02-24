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
        myUniqueValuesCount: 'cardinality',
        myUniqueValuesCountFromArray: 'cardinality',
      },
    },
  })

  console.log('------- create --------')

  let myArticle = await db.create('article', {
    myUniqueValuesCount: 'myCoolValue',
  })

  deepEqual(
    (
      await db
        .query('article')
        .include('myUniqueValuesCount', 'myUniqueValuesCountFromArray')
        .get()
    ).toObject(),
    [
      {
        id: 1,
        myUniqueValuesCount: 1,
        myUniqueValuesCountFromArray: 0,
      },
    ],
  )

  await db.create('article', {
    myUniqueValuesCountFromArray: [
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

  deepEqual(
    (
      await db
        .query('article')
        .include('myUniqueValuesCount', 'myUniqueValuesCountFromArray')
        .get()
    ).toObject(),
    [
      { id: 1, myUniqueValuesCount: 1, myUniqueValuesCountFromArray: 0 },
      { id: 2, myUniqueValuesCountFromArray: 7, myUniqueValuesCount: 0 },
    ],
  )

  console.log('------- update --------')

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

  console.log(await db.drain(), 'ms')

  deepEqual(
    (
      await db
        .query('article')
        .include('myUniqueValuesCount', 'myUniqueValuesCountFromArray')
        .get()
    ).toObject(),
    [
      { id: 1, myUniqueValuesCount: 7, myUniqueValuesCountFromArray: 0 },
      { id: 2, myUniqueValuesCountFromArray: 7, myUniqueValuesCount: 0 },
    ],
  )

  const feeling = ['folish', 'superficial', 'deep', 'moving', 'fake']

  let feelings = []
  for (let i = 0; i < 1e6; i++) {
    feelings.push(
      xxHash64(
        Buffer.from(feeling[Math.floor(Math.random() * (feeling.length - 1))]),
      ),
    )
  }

  await db.update('article', myArticle, {
    myUniqueValuesCount: feelings,
  })

  console.log(await db.drain(), 'ms')

  console.log(await db.query('article').get().toObject())

  // 120Mb / s
  console.log('START')

  for (let i = 0; i < 10; i++) {
    db.create('article', {
      myUniqueValuesCount: feelings,
    })
  }

  console.log(await db.drain(), 'ms')
  console.log('---------------')

  // await db.query('article').range(0, 1e6).get().inspect(10)
  // await db.query('article').range(0, 1e6).get().inspect(10)
})
