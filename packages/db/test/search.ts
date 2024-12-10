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
          date: { type: 'timestamp' },
          title: { type: 'string' },
          body: { type: 'string', compression: 'none' }, // big compressed string...
        },
      },
    },
  })
  for (let i = 0; i < 2; i++) {
    const d = Date.now()
    await db.create('italy', {
      date: d + i,
      // if match from start also get it
      body: i == 0 ? 'Netherlands' : 'Italy! netherlunds',
      // body:
      // italy +
      // ' aaaaa amsterdam twitter ew jfweoifj weoifhweoif woiewrhfweo fniowefewoifhnweoif weif weofnweoin fewoihfweoifhewioh fweoifweh iweoih',
    })
  }

  const r = await db
    .query('italy')
    .search('Italy netherlands', { body: 1 })
    .include('id', 'body', 'date')
    .range(0, 3)
    // .sort('date')
    .get()

  r.inspect()
})

/*
 let blocks = 0
  const x = q.toLowerCase().split(' ')
  const bufs = []
  for (const s of x) {
    bufs.push(Buffer.from(s))
    blocks++
  }
  const blocksSize = Buffer.allocUnsafe(2)
  blocksSize.writeUint16LE(blocks)
  bufs.unshift(blocksSize)
  const query = Buffer.concat(bufs)

  console.log(new Uint8Array(query))
*/
