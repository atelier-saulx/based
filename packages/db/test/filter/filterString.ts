import { decompress } from '@based/protocol/db-read'
import { BasedDb, stringCompress as compress } from '../../src/index.js'
import test from '../shared/test.js'
import { equal, deepEqual } from '../shared/assert.js'
import { italy, sentence, readBible } from '../shared/examples.js'

const bible = readBible()

const ENCODER = new TextEncoder()
const capitals =
  'AAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAAAAAAAAAAA AAA A AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

await test('variable size (string/binary)', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      article: {
        props: {
          type: ['opinion', 'politcis', 'gossip'],
          code: { type: 'string', maxBytes: 2 },
          age: { type: 'uint32' },
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
      stuff: ENCODER.encode('#' + i),
      derp: new Uint8Array([1, 0, 0, 2, 0, 0]),
    })
  }

  await db.drain()

  deepEqual(
    (
      await db
        .query('article')
        .filter('stuff', '=', ENCODER.encode('#' + 2))
        .include('name', 'stuff', 'derp', 'type')
        .range(0, 10)
        .get()
    ).toObject(),
    [
      {
        id: 3,
        type: 'gossip',
        name: 'Gossip #2',
        stuff: new Uint8Array([35, 50]),
        derp: new Uint8Array([1, 0, 0, 2, 0, 0]),
      },
    ],
    'strict equality on binary',
  )

  const len = (
    await db
      .query('article')
      .filter('stuff', 'includes', new Uint8Array([55, 57]))
      .range(0, 100)
      .get()
  ).length

  equal(len, 20, 'has binary (single')

  const largeDerp = ENCODER.encode(italy)
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
    (
      await db
        .query('article')
        .filter('derp', 'includes', ENCODER.encode('vitorio'))
        .include('id')
        .get()
    ).length,
    0,
    'has filter on derp',
  )

  equal(
    (
      await db
        .query('article')
        .filter('derp', 'includes', ENCODER.encode('xx'))
        .include('id')
        .get()
    ).length,
    0,
    'has filter on derp (short)',
  )

  equal(
    (
      await db
        .query('article')
        .filter('derp', 'includes', q)
        .include('id')
        .get()
    ).length,
    0,
    'has filter on derp (long q)',
  )

  equal(
    (
      await db
        .query('article')
        .filter('derp', '=', largeDerp)
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1e3,
    'strict equality binary (large)',
  )

  equal(
    (
      await db
        .query('article')
        .filter('body', '=', italy)
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1e3,
    'strict equality large compressed string',
  )
})

await test('has compressed', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await db.setSchema({
    types: {
      italy: {
        props: {
          body: { type: 'string' }, // big compressed string...
        },
      },
    },
  })

  const compressedItaly = compress(bible)

  for (let i = 0; i < 1; i++) {
    await db.create('italy', {
      body: compressedItaly,
    })
  }

  const n = `Therefore he called the name of that place Baalperazim`

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'includes', n)
        .include('id')
        .range(0, 1e3)
        .get()
    ).toObject().length,
    1,
  )
})

await test('has uncompressed', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      italy: {
        props: {
          f: 'boolean',
          headline: { type: 'string', compression: 'none' },
          body: { type: 'string', compression: 'none' }, // big compressed string...
        },
      },
    },
  })

  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      f: false,
      headline:
        i === 500
          ? 'Hungarian woman linked to Lebanon pager blasts was EU'
          : i === 600
            ? 'Derpy derp derp exploding-pager merp'
            : i === 602
              ? 'P p p ppppp p pppp p p Italy is the greatest'
              : i === 800
                ? 'UN experts slam global inaction, as famine takes hold across entire Gaza'
                : '',
      body: italy,
    })
  }

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'includes', 'derp derp derp', { lowerCase: true })
        .include('id')
        .range(0, 1e3)
        .get()
    ).toObject().length,
    0,
  )

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'includes', 'derp derp derp')
        .include('id')
        .range(0, 1e3)
        .get()
    ).toObject().length,
    0,
  )

  deepEqual(
    await db
      .query('italy')
      .filter('headline', 'includes', 'pager')
      .include('id', 'headline')
      .range(0, 1e3)
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 501,
        headline: 'Hungarian woman linked to Lebanon pager blasts was EU',
      },
      {
        id: 601,
        headline: 'Derpy derp derp exploding-pager merp',
      },
    ],
  )

  deepEqual(
    await db
      .query('italy')
      .filter('headline', 'includes', 'Pager', { lowerCase: true })
      .include('id', 'headline')
      .range(0, 1e3)
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 501,
        headline: 'Hungarian woman linked to Lebanon pager blasts was EU',
      },
      {
        id: 601,
        headline: 'Derpy derp derp exploding-pager merp',
      },
    ],
  )

  deepEqual(
    await db
      .query('italy')
      .filter('headline', 'includes', 'refugee', { lowerCase: true })
      .include('id', 'headline')
      .range(0, 1e3)
      .get()
      .then((v) => v.toObject()),
    [],
  )

  deepEqual(
    await db
      .query('italy')
      .filter('headline', 'includes', 'gaza', { lowerCase: true })
      .include('id', 'headline')
      .range(0, 1e3)
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 801,
        headline:
          'UN experts slam global inaction, as famine takes hold across entire Gaza',
      },
    ],
  )
})

await test('main has (string/binary)', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await db.setSchema({
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
  deepEqual((await db.query('article').get()).toObject(), [derpResult])
  deepEqual(
    (await db.query('article').filter('stuff', '=', stuff).get()).toObject(),
    [derpResult],
  )
  deepEqual(
    (
      await db
        .query('article')
        .filter('derp', 'includes', new Uint8Array([4]))
        .get()
    ).toObject(),
    [derpResult],
  )
})

await test('has normalized uncompressed', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      italy: {
        props: {
          body: { type: 'string', compression: 'none' }, // big compressed string...
        },
      },
    },
  })

  for (let i = 0; i < 1e5; i++) {
    db.create('italy', {
      body: capitals,
    })
  }

  await db.drain()

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'includes', 'aaaaaa', { lowerCase: true })
        .include('id')
        .range(0, 1e5)
        .get()
    ).length,
    1e5,
  )
})

await test('has normalized compressed', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      italy: {
        props: {
          body: { type: 'string' }, // big compressed string...
        },
      },
    },
  })

  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      body: capitals + capitals + capitals + capitals,
    })
  }

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'includes', 'aaaaa', { lowerCase: true })
        .include('id', 'body')
        .range(0, 1e3)
        .get()
    ).length,
    1e3,
  )
})

await test('has OR uncompressed', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      italy: {
        props: {
          f: 'boolean',
          title: 'string',
          body: { type: 'string', compression: 'none' },
        },
      },
    },
  })

  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      f: false,
      title:
        i === 500
          ? 'UN experts slam global inaction, as famine takes hold across entire Gaza'
          : 'derp',
      body: i === 999 ? italy + ' aaabbbbbbbbbaaa' : italy,
    })
  }

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'includes', ['aaaaaaaaaaa', 'bbbbbb'], {
          lowerCase: true,
        }) //  ['aaa', 'bbb', 'ccc', 'eee']
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1,
  )

  deepEqual(
    await db
      .query('italy')
      .filter('title', 'includes', ['gaza', 'tubbies'], { lowerCase: true })
      .include('id', 'title')
      .range(0, 1e3)
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 501,
        title:
          'UN experts slam global inaction, as famine takes hold across entire Gaza',
      },
    ],
  )

  deepEqual(
    await db
      .query('italy')
      .filter('title', 'includes', ['crisis', 'refugee'], { lowerCase: true })
      .include('id', 'title')
      .range(0, 1e3)
      .get()
      .then((v) => v.toObject()),
    [],
  )
})

await test('has OR compressed', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      italy: {
        props: {
          f: 'boolean',
          body: { type: 'string' },
        },
      },
    },
  })

  const compressedItaly = compress(italy)

  const amount = 2
  for (let i = 0; i < amount; i++) {
    await db.create('italy', {
      f: false,
      body: i === amount - 1 ? italy + ' aaabbbbbbbbbaaa' : compressedItaly,
    })
  }
  equal(
    (
      await db
        .query('italy')
        .filter('body', 'includes', ['aaaaaaaaaaa', 'bbbbbbbb'], {
          lowerCase: true,
        }) //  ['aaa', 'bbb', 'ccc', 'eee']
        .include('id')
        .range(0, 1e3)
        .get()
    ).length,
    1,
  )
})

await test('OR equal', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      italy: {
        props: {
          f: 'boolean',
          body: { type: 'string' },
        },
      },
    },
  })

  const derpItaly = italy + ' aaabbbbbbbbbaaa'
  const compressedItaly = compress(italy)

  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      f: false,
      body: i === 999 ? derpItaly : compressedItaly,
    })
  }

  equal(
    (
      await db
        .query('italy')
        .filter('body', '=', [derpItaly, 'derp', italy])
        .range(0, 1e3)
        .get()
    ).length,
    1e3,
  )
})

await test('OR equal main', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      italy: {
        props: {
          body: { type: 'string', maxBytes: 5 },
        },
      },
    },
  })

  for (let i = 0; i < 10; i++) {
    await db.create('italy', {
      body: i === 9 ? 'bb' : 'aa',
    })
  }

  equal(
    (
      await db
        .query('italy')
        .filter('body', '=', ['xx', 'bb'])
        .range(0, 1e3)
        .get()
    ).length,
    1,
  )
})

await test('includes and neq', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await db.setSchema({
    types: {
      ent: {
        props: {
          city: { type: 'string', maxBytes: 15 },
          country: { type: 'string', maxBytes: 15 },
        },
      },
    },
  })

  db.create('ent', {
    city: 'Rome',
    country: 'Italy',
  })
  db.create('ent', {
    city: 'Rome',
    country: 'USA',
  })
  db.create('ent', {
    city: 'Cologne',
    country: 'Germany',
  })
  db.create('ent', {
    city: 'Berlin',
    country: 'Germany',
  })
  db.create('ent', {
    city: 'Berlin',
    country: 'USA',
  })
  db.create('ent', {
    city: 'Paris',
    country: 'France',
  })
  db.create('ent', {
    city: 'Paris',
    country: 'Canada',
  })

  deepEqual(
    await db
      .query('ent')
      .filter('country', 'includes', ['Italy', 'Germany'])
      .filter('city', '!=', 'Berlin')
      .get(),
    [
      { id: 1, city: 'Rome', country: 'Italy' },
      { id: 3, city: 'Cologne', country: 'Germany' },
    ],
  )
})

await test('empty string', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          potato: 'string',
        },
      },
    },
  })

  const user1 = db.create('user', {
    potato: 'cool',
  })

  const user2 = db.create('user', {})

  const user3 = db.create('user', { potato: '' })

  console.log(await db.query('user').filter('patato', '=', '').get())

  deepEqual(
    await db.query('user').filter('patato', '=', '').get(),
    [
      {
        id: 2,
        potato: '',
      },
      {
        id: 3,
        potato: '',
      },
    ],
    'Empty string filter',
  )
})
