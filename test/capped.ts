import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('capped type', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      meas: {
        capped: 3,
        props: {
          temperature: 'number',
          humidity: 'number',
          wind: { type: 'number', default: 10 },
        },
      },
    },
  })

  db.create('meas', {
    temperature: 0,
    humidity: 99,
  })
  db.create('meas', {
    temperature: 1,
    humidity: 98,
  })
  db.create('meas', {
    temperature: 2,
    humidity: 97,
    wind: 50,
  })

  deepEqual(await db.query('meas').get(), [
    { id: 1, temperature: 0, humidity: 99, wind: 10 },
    { id: 2, temperature: 1, humidity: 98, wind: 10 },
    { id: 3, temperature: 2, humidity: 97, wind: 50 },
  ])

  db.create('meas', {
    temperature: -100,
    humidity: 1,
  })

  deepEqual(await db.query('meas').get(), [
    { id: 1, temperature: -100, humidity: 1, wind: 10 },
    { id: 2, temperature: 1, humidity: 98, wind: 10 },
    { id: 3, temperature: 2, humidity: 97, wind: 50 },
  ])

  db.create('meas', {
    temperature: -50,
    humidity: 1,
    wind: 5,
  })
  db.create('meas', {
    temperature: -40,
    humidity: 1,
  })

  deepEqual(await db.query('meas').get(), [
    { id: 1, temperature: -100, humidity: 1, wind: 10 },
    { id: 2, temperature: -50, humidity: 1, wind: 5 },
    { id: 3, temperature: -40, humidity: 1, wind: 10 },
  ])

  db.create('meas', {
    temperature: -50,
    humidity: 1,
  })
  db.create('meas', {
    temperature: -40,
    humidity: 1,
  })
  db.create('meas', {
    temperature: -50,
    humidity: 1,
    wind: 5,
  })
  db.create('meas', {
    temperature: -40,
    humidity: 1,
  })
  db.create('meas', {
    temperature: -50,
    humidity: 1,
  })
  db.create('meas', {
    temperature: -40,
    humidity: 1,
  })

  deepEqual(await db.query('meas').get(), [
    { id: 1, temperature: -40, humidity: 1, wind: 10 },
    { id: 2, temperature: -50, humidity: 1, wind: 10 },
    { id: 3, temperature: -40, humidity: 1, wind: 10 },
  ])
})

await test('capped references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          latestArticles: {
            type: 'references',
            capped: 5,
            items: {
              ref: 'article',
              prop: 'latest',
            },
          },
        },
      },
      article: {
        props: {
          latest: {
            type: 'reference',
            ref: 'user',
            prop: 'latestArticles',
          },
        },
      },
    },
  })

  const user = await db.create('user', {})
  for (let i = 0; i < 10; i++) {
    db.create('article', { latest: user })
  }

  deepEqual(await db.query('user', user).include('**').get(), {
    id: 1,
    latestArticles: [{ id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 }],
  })
})
