import { BasedDb, compress, decompress } from '../src/index.js'
import test from './shared/test.js'
import { equal, deepEqual } from './shared/assert.js'
import { italy, sentence } from './shared/examples.js'

await test('variable size (string/binary)', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })
  db.putSchema({
    types: {
      article: {
        props: {
          type: ['opinion', 'politcis', 'gossip'],
          code: { type: 'string', maxBytes: 2 },
          name: { type: 'string' },
          body: { type: 'string' }, // big compressed string...
          stuff: 'binary',
          derp: 'binary',
        },
      },
      italy: {
        props: {
          body: { type: 'string' }, // big compressed string...
        },
      },
    },
  })
  const compressedSentence = compress(sentence)
  equal(decompress(compressedSentence), sentence, 'compress / decompress api')
  const compressedItaly = compress(italy)
  equal(decompress(compressedItaly), italy, 'compress / decompress api (large)')
  for (let i = 0; i < 1000; i++) {
    const str = 'en'
    db.create('article', {
      type: 'gossip',
      code: str,
      name: 'Gossip #' + i,
      body: compressedItaly,
      stuff: Buffer.from('#' + i),
      derp: new Uint8Array([1, 0, 0, 2, 0, 0]),
    })
  }
  deepEqual(
    db
      .query('article')
      .filter('stuff', '=', Buffer.from('#' + 2))
      .range(0, 10)
      .get()
      .toObject(),
    [
      {
        id: 3,
        type: 'gossip',
        code: 'en',
        name: 'Gossip #2',
        body: italy,
        stuff: new Uint8Array([35, 50]),
        derp: new Uint8Array([1, 0, 0, 2, 0, 0]),
      },
    ],
  )
  const len = db
    .query('article')
    .filter('stuff', 'has', new Uint8Array([55, 57]))
    .range(0, 100)
    .get().length
  equal(len, 6, 'has binary (single')
  const largeDerp = Buffer.from(italy)
  let smurpArticle
  for (let i = 0; i < 1e3; i++) {
    smurpArticle = db.create('article', {
      type: 'gossip',
      code: 'xa',
      name: 'Smurp',
      body: 'Derp derp',
      derp: largeDerp,
    })
  }
  await db.drain()
  const q = new Uint8Array(251)
  for (let i = 0; i < 250; i++) {
    q[i] = i
  }
  q[250] = 255
  equal(
    db
      .query('article')
      .filter('derp', 'has', Buffer.from('vitorio'))
      .include('id')

      .get()
      .inspect(10).length,
    0,
  )
  equal(
    db
      .query('article')
      .filter('derp', 'has', Buffer.from('xx'))
      .include('id')
      .get().length,
    0,
  )
  equal(
    db.query('article').filter('derp', 'has', q).include('id').get().length,
    0,
  )
  equal(
    db
      .query('article')
      .filter('derp', '=', largeDerp)
      .include('id')
      .range(0, 1e3)
      .get().length,
    1e3,
  )
  equal(
    db
      .query('article')
      .filter('body', '=', italy)
      .include('id')
      .range(0, 1e3)
      .get().length,
    1e3,
  )
})

await test('compressed has', async (t) => {
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
          body: { type: 'string' }, // big compressed string...
        },
      },
    },
  })
  const compressedItaly = compress(italy)
  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      body: compressedItaly,
    })
  }
  db
    .query('italy')
    .filter('body', 'has', 'derp derp derp')
    .include('id')
    .range(0, 1e3)
    .get()
    .inspect(10).length

  db
    .query('italy')
    .filter('body', 'hasLoose', 'Derp derp derp')
    .include('id')
    .range(0, 1e3)
    .get()
    .inspect(10).length
})

await test('uncompressed has', async (t) => {
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
  db
    .query('italy')
    .filter('body', 'has', 'derp derp derp')
    .include('id')
    .range(0, 1e3)
    .get()
    .inspect(10).length

  db
    .query('italy')
    .filter('body', 'hasLoose', 'Derp derp derp')
    .include('id')
    .range(0, 1e3)
    .get()
    .inspect(10).length
})

await test('main has (string/binary)', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })
  db.putSchema({
    types: {
      article: {
        props: {
          derp: { type: 'binary', maxBytes: 30 },
          stuff: { type: 'string', maxBytes: 30 },
        },
      },
    },
  })
  const stuff = 'aaaa'
  await db.create('article', {
    stuff,
    derp: new Uint8Array([1, 2, 3, 4]),
  })
  const derpResult = {
    id: 1,
    stuff,
    derp: new Uint8Array([1, 2, 3, 4]),
  }
  deepEqual(db.query('article').get().toObject(), [derpResult])
  deepEqual(db.query('article').filter('stuff', '=', stuff).get().toObject(), [
    derpResult,
  ])
  deepEqual(
    db
      .query('article')
      .filter('derp', 'has', new Uint8Array([4]))
      .get()
      .toObject(),
    [derpResult],
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

  //
  db
    .query('italy')
    .filter('body', 'search', 'vctorio')
    .include('id')
    .range(0, 1e3)
    .get()
    .inspect(10).length
})
