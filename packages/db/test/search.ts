import { BasedDb, compress } from '../src/index.js'
import test from './shared/test.js'
import { equal } from './shared/assert.js'
import { italy } from './shared/examples.js'

await test('like filter', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      italy: {
        props: {
          body: { type: 'string', compression: 'none' },
        },
      },
    },
  })

  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      body: italy,
    })
  }

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'like', 'italy')
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1e3,
  )

  equal(
    (
      await db
        .query('italy')
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
        .query('italy')
        .filter('body', 'like', ['snurfelpants', 'italy'])
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1e3,
  )
})

await test('search', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })
  db.putSchema({
    types: {
      italy: {
        props: {
          date: { type: 'uint32' },
          title: { type: 'string' },
          body: { type: 'string', compression: 'none' }, // big compressed string... compression: 'none'
        },
      },
    },
  })

  const compressItaly = compress(italy)
  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      date: i,
      body: i == 0 ? 'Mr giraffe first' : i == 2 ? 'Mr giraffe second' : italy,
      // body:
      // italy +
      // ' aaaaa amsterdam twitter ew jfweoifj weoifhweoif woiewrhfweo fniowefewoifhnweoif weif weofnweoin fewoihfweoifhewioh fweoifweh iweoih',
    })
  }

  // creates lmdb stupid index
  await db.query('italy').sort('date').get()

  // sort + search
  let r = await db
    .query('italy')
    .search('Netherlands', { body: 0, title: 1 })
    .include('id', 'date')
    .range(0, 1e3)
    .sort('date')
    .get()

  r.inspect()

  // default + search
  r = await db
    .query('italy')
    .search('Netherlands', { body: 0, title: 1 })
    .include('id', 'date')
    .range(0, 1e3)
    .get()

  r.inspect()

  // // ids + sort + search
  // r = await db
  //   .query('italy', [1, 2, 3])
  //   .search('Netherlands', { body: 0 })
  //   .include('id', 'date')
  //   .range(0, 1e3)
  //   // .sort('date')
  //   .get()

  // r.inspect()

  // // ids + search
  // r = await db
  //   .query('italy', [1, 2, 3])
  //   .search('Netherlands', { body: 0 })
  //   .include('id', 'date')
  //   .range(0, 1e3)
  //   .get()

  // r.inspect()
})
