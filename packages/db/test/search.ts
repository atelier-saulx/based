import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { equal } from './shared/assert.js'
import { italy } from './shared/examples.js'

await test('like filter', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      article: {
        props: {
          body: { type: 'string', compression: 'none' },
          nr: { type: 'uint32' },
        },
      },
    },
  })

  for (let i = 0; i < 1e3; i++) {
    await db.create('article', {
      body: italy,
      nr: i,
    })
  }

  equal(
    (
      await db
        .query('article')
        .filter('body', 'like', 'article')
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1e3,
  )

  equal(
    (
      await db
        .query('article')
        .filter('body', 'like', 'snurfelpants')
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    0,
  )

  equal(
    (
      await db
        .query('article')
        .filter('body', 'like', ['snurfelpants', 'article'])
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1e3,
  )

  equal(
    (
      await db
        .query('article')
        .filter('body', 'like', 'kxngdom')
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1e3,
    'kxngdom 1000 results',
  )

  equal(
    (
      await db
        .query('article')
        .filter('body', 'like', 'derperp')
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    0,
    'derp no results',
  )

  equal(
    (
      await db
        .query('article')
        .filter('body', 'like', 'kxngdom', { score: 0 })
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    0,
    'kxngdom 0 results',
  )
})

await test('compressed', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      article: {
        props: {
          date: { type: 'uint32' },
          title: { type: 'string' },
          body: { type: 'string' },
        },
      },
    },
  })

  const amount = 100

  for (let i = 0; i < amount; i++) {
    await db.create('article', {
      date: i,
      title: 'Derp derp ' + i,
      body: i == 0 ? 'Mr giraffe first' : i == 2 ? 'Mr giraffe second' : italy,
    })
  }

  // sort + search
  equal(
    await db
      .query('article')
      .search('Netherlands', { body: 0, title: 1 })
      .include('id', 'date')
      .range(0, amount)
      .get()
      .then((v) => v.length),
    amount - 2,
    'Search sorted body "netherlands"',
  )

  equal(
    await db
      .query('article')
      .search('giraffe', { body: 0, title: 1 })
      .include('id', 'date', 'title')
      .range(0, amount)
      .get()
      .then((v) => v.length),
    2,
    'Search sorted body "giraffe"',
  )

  equal(
    await db
      .query('article')
      .search('kingdom', { body: 0, title: 1 })
      .include('id', 'date', 'title')
      .sort('date')
      .range(0, amount)
      .get()
      .then((v) => v.length),
    amount - 2,
    'Search sorted body "kingdom"',
  )

  equal(
    await db
      .query('article')
      .search('Netherlands', { body: 0, title: 1 })
      .include('id', 'date')
      .sort('date')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    amount - 2,
    'Search sorted body "netherlands" sorted',
  )

  equal(
    await db
      .query('article')
      .search('giraffe', { body: 0, title: 1 })
      .include('id', 'date', 'title')
      .sort('date')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    2,
    'Search sorted body "giraffe" sorted',
  )

  equal(
    await db
      .query('article')
      .search('derp', { body: 0, title: 1 })
      .include('id', 'date', 'title')
      .sort('date')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    amount,
    'Search sorted "derp"',
  )

  equal(
    await db
      .query('article')
      .search('first', { body: 0, title: 1 })
      .include('id', 'date', 'title', 'body')
      .sort('date')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    amount - 1,
    'Search sorted "first"',
  )

  equal(
    await db
      .query('article')
      .search('second', { body: 0, title: 1 })
      .include('id', 'date', 'title')
      .sort('date')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    amount - 1,
    'Search sorted "second"',
  )

  equal(
    await db
      .query('article')
      .search('giraffe first', { body: 0, title: 1 })
      .include('id', 'date', 'title')
      .sort('date')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    1,
    'Search sorted combined "giraffe first"',
  )

  equal(
    await db
      .query('article')
      .search('italy netherlands', { body: 0, title: 1 })
      .include('id', 'date', 'title')
      .sort('date')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    amount - 2,
    'Search sorted combined "italy netherlands"',
  )

  equal(
    await db
      .query('article')
      .search('italy netherlands', 'body', 'title')
      .include('id', 'date', 'title')
      .sort('date')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    amount - 2,
    'Search (arg syntax) sorted combined "italy netherlands"',
  )

  equal(
    await db
      .query('article')
      .search('italy netherlands', 'body', 'title')
      .include('id', 'date', 'title')
      .sort('date')
      .filter('date', '>', amount - 10)
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    10 - 1,
    'Search (arg syntax) sorted + filter combined "italy netherlands"',
  ) })
await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      article: {
        props: {
          date: { type: 'uint32' },
          title: { type: 'string', maxBytes: 20 },
          body: { type: 'string', compression: 'none' }, // big compressed string... compression: 'none'
        },
      },
    },
  })

  await db.create('article', {
    date: 0,
    title: 'Derp derp',
    body: 'Mr giraffe first',
  })

  equal(
    await db
      .query('article')
      .search('giraffe first', 'body')
      .include('id', 'date', 'title')
      .sort('date')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    1,
    'Search sorted combined "giraffe first"',
  )

  equal(
    await db
      .query('article')
      .search('derp derp', 'body', 'title')
      .include('id', 'date', 'title')
      .sort('date')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    1,
    'Search sorted combined "derp derp"',
  )
})

await test('search ids', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      article: {
        props: {
          date: { type: 'uint32' },
          title: { type: 'string', maxBytes: 20 },
          body: { type: 'string', compression: 'none' }, // big compressed string... compression: 'none'
        },
      },
    },
  })

  const first = await db.create('article', {
    date: 1,
    title: 'Derp derp',
    body: 'Mr giraffe first',
  })

  const second = await db.create('article', {
    date: 2,
    title: 'Derp derp',
    body: 'Mr giraffe second',
  })

  for (let i = 0; i < 1e3; i++) {
    await db.create('article', {
      date: 3,
      body: italy,
      title: 'big time',
    })
  }

  equal(
    await db
      .query('article', [first, second])
      .search('first', 'body')
      .include('id', 'date', 'title')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    1,
    'Search ids combined "giraffe first"',
  )

  equal(
    await db
      .query('article', [first, second])
      .search('first', 'body')
      .sort('date')
      .include('id', 'date', 'title')
      .range(0, 1e3)
      .get()
      .then((v) => v.length),
    1,
    'Search ids sorted combined "giraffe first"',
  )
})

await test('like filter mbs', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  db.setSchema({
    types: {
      article: {
        props: {
          body: { type: 'string', compression: 'none' },
          nr: { type: 'uint32' },
        },
      },
    },
  })

  await db.create('article', {
    body: 'Aleksei Mihailovitšin vanhemmat olivat Venäjän ensimmäinen Romanov-sukuinen tsaari Mikael Romanov ja hänen toinen puolisonsa Jevdokia Lukjanovna Strešnjova (1608–1645).',
  })
  await db.create('article', {
    body: 'Fjodor Fjodorovitš Tšerenkov (ven. Фёдор Фёдорович Черенко́в, 3. toukokuuta 1959 Moskova, Venäjän SFNT – 4. lokakuuta 2014 Moskova, Venäjä) oli urheilu-urallaan Neuvostoliittoa edustanut jalkapalloilija ja olympiamitalisti.',
  })

  equal(
    (
      await db
        .query('article')
        .filter('body', 'like', 'mihailovitsin')
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1,
  )
  equal(
    (
      await db
        .query('article')
        .filter('body', 'like', 'mihailovitšin')
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1,
  )
})
