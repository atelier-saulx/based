import { BasedDb, compress, decompress } from '../src/index.js'
import test from './shared/test.js'
import { equal, deepEqual } from './shared/assert.js'
import { italy, sentence, bible } from './shared/examples.js'

const capitals =
  'AAAAAAAAAA AAAAAAAAAAA AAAAAAAAAAAAAAAAAAAA AAA A AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

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
  for (let i = 0; i < 1e3; i++) {
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
    (
      await db
        .query('article')
        .filter('stuff', '=', Buffer.from('#' + 2))
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
  )
  const len = (
    await db
      .query('article')
      .filter('stuff', 'has', new Uint8Array([55, 57]))
      .range(0, 100)
      .get()
  ).length
  // ???
  equal(len, 20, 'has binary (single')
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
    (
      await db
        .query('article')
        .filter('derp', 'has', Buffer.from('vitorio'))
        .include('id')
        .get()
    ).length,
    0,
  )
  equal(
    (
      await db
        .query('article')
        .filter('derp', 'has', Buffer.from('xx'))
        .include('id')
        .get()
    ).length,
    0,
  )
  equal(
    (await db.query('article').filter('derp', 'has', q).include('id').get())
      .length,
    0,
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
  )
})

await test('has compressed', async (t) => {
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

  const compressedItaly = compress(bible)
  for (let i = 0; i < 1; i++) {
    await db.create('italy', {
      body: compressedItaly,
    })
  }

  const n = `Therefore he called the name of that place Baalperazim.
  And there they left their images, and David and his men burned them. `

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'has', n)
        .include('id')
        .range(0, 1e3)
        .get()
    ).inspect().length,
    0,
  )
})

await test('has uncompressed', async (t) => {
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
          f: 'boolean',
          body: { type: 'string', compression: 'none' }, // big compressed string...
        },
      },
    },
  })
  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      f: false,
      body: italy,
    })
  }

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'hasLoose', 'derp derp derp')
        .include('id')
        .range(0, 1e3)
        .get()
    ).inspect().length,
    0,
  )
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
  deepEqual((await db.query('article').get()).toObject(), [derpResult])
  deepEqual(
    (await db.query('article').filter('stuff', '=', stuff).get()).toObject(),
    [derpResult],
  )
  deepEqual(
    (
      await db
        .query('article')
        .filter('derp', 'has', new Uint8Array([4]))
        .get()
    ).toObject(),
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

await test('hasLoose uncompressed', async (t) => {
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

  for (let i = 0; i < 1e5; i++) {
    await db.create('italy', {
      body: capitals,
    })
  }

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'hasLoose', 'aaaaaa')
        .include('id')
        .range(0, 1e5)
        .get()
    ).length,
    1e5,
  )
})

await test('hasLoose compressed', async (t) => {
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

  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      body: capitals + capitals + capitals + capitals,
    })
  }

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'hasLoose', 'aaaaa')
        .include('id', 'body')
        .range(0, 1e3)
        .get()
    ).length,
    1e3,
  )
})

// -------- or later...
await test('has OR uncompressed', async (t) => {
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
          f: 'boolean',
          body: { type: 'string', compression: 'none' },
        },
      },
    },
  })

  for (let i = 0; i < 1e3; i++) {
    await db.create('italy', {
      f: false,
      body: i === 999 ? italy + ' aaabbbbbbbbbaaa' : italy,
    })
  }

  equal(
    (
      await db
        .query('italy')
        .filter('body', 'hasLoose', ['aaaaaaaaaaa', 'bbbbbb']) //  ['aaa', 'bbb', 'ccc', 'eee']
        .include('id')
        .range(0, 1e3)
        .get()
    ).inspect().length,
    1,
  )
})

await test('has OR compressed', async (t) => {
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
        .filter('body', 'hasLoose', ['aaaaaaaaaaa', 'bbbbbb']) //  ['aaa', 'bbb', 'ccc', 'eee']
        .include('id')
        .range(0, 1e3)
        .get()
    ).inspect().length,
    1,
  )
})

await test('OR equal', async (t) => {
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

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
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
