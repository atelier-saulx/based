import { BasedDb, xxHash64 } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from 'node:assert'
import { setTimeout as setTimeoutAsync } from 'timers/promises'

await test('sortCardinality', async (t) => {
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
        brazilians: 'cardinality',
      },
    },
  })

  let test = await db.create('article', {
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
    brazilians: 'marco',
  })

  let myArticle = await db.create('article', {
    count: 'myCoolValue',
    derp: 100,
    brazilians: 'marco', // add logic to deal with update without create
  })

  await db
    .query('article')
    .sort('count', 'desc')
    .include('count')
    .get()
    .inspect()

  await db.query('article').sort('count', 'asc').include('derp').get().inspect()

  await db.update('article', myArticle, {
    count: 'lala',
  })

  await db.drain()

  await db
    .query('article')
    .sort('count', 'asc')
    .include('count', 'brazilians')
    .get()
    .inspect()

  const names = [
    'João',
    'Maria',
    'José',
    'Ana',
    'Paulo',
    'Carlos',
    'Lucas',
    'Mariana',
    'Fernanda',
    'Gabriel',
  ]

  let brazos = []
  for (let i = 0; i < 1e6; i++) {
    brazos.push(names[Math.floor(Math.random() * names.length)] + i)
  }

  console.time('1M Distinct Brazos update')
  await db.update('article', myArticle, {
    brazilians: brazos,
  })
  console.timeEnd('1M Distinct Brazos update')

  await db.drain()

  await db
    .query('article')
    .sort('brazilians', 'desc')
    .include('count', 'brazilians')
    .get()
    .inspect()

  db.delete('article', test)

  await db
    .query('article')
    .sort('brazilians', 'desc')
    .include('count', 'brazilians')
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
