import { BasedDb, compress, decompress } from '../src/index.js'
import test from './shared/test.js'
import { equal, deepEqual } from './shared/assert.js'
import { italy, sentence, bible } from './shared/examples.js'

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
          body: { type: 'string', compression: 'none' }, // big compressed string...
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
        .filter('body', 'like', 'derp')
        .include('id')
        .range(0, 1e3)
        .get()
    ).inspect().length,
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
          title: { type: 'string' },
          body: { type: 'string', compression: 'none' }, // big compressed string...
        },
      },
    },
  })
  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      // body: 'bla and Netherlands is really nice yes what do you want now? fun?',
      body:
        italy +
        ' aaaaa ew jfweoifj weoifhweoif woiewrhfweo fniowefewoifhnweoif weif weofnweoin fewoihfweoifhewioh fweoifweh iweoih',
    })
  }

  const r = await db
    .query('italy')
    .filter('body', 'hasLoose', 'derp derp derp')
    // .search('netherlunds', { body: 1 })
    .include('id')
    .range(0, 1e3)
    .get()

  r.inspect()
})
