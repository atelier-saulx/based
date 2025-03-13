import { BasedDb, equals } from '../src/index.js'
import test from './shared/test.js'
import { throws, deepEqual } from './shared/assert.js'
import native from '../src/native.js'

await test('wipe', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      data: {
        props: {
          a: {
            type: 'vector',
            size: 5,
          },
          age: { type: 'uint32' },
          name: { type: 'string', maxBytes: 10 },
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('data', {
      age: i,
    })
  }

  console.log('set 1m', await db.drain())
  deepEqual(await db.query('data').range(0, 10).get().toObject(), [
    { id: 1, age: 0, name: '', a: '' },
    { id: 2, age: 1, name: '', a: '' },
    { id: 3, age: 2, name: '', a: '' },
    { id: 4, age: 3, name: '', a: '' },
    { id: 5, age: 4, name: '', a: '' },
    { id: 6, age: 5, name: '', a: '' },
    { id: 7, age: 6, name: '', a: '' },
    { id: 8, age: 7, name: '', a: '' },
    { id: 9, age: 8, name: '', a: '' },
    { id: 10, age: 9, name: '', a: '' },
  ])

  await db.save()

  await db.wipe()

  await db.putSchema({
    types: {
      x: {
        props: {
          a: {
            type: 'vector',
            size: 5,
          },
          age: { type: 'uint32' },
          name: { type: 'string', maxBytes: 10 },
        },
      },
    },
  })

  await throws(() => db.query('data').get(), true)
  for (let i = 0; i < 1e6; i++) {
    db.create('x', {
      age: i,
    })
  }
  console.log('set 1m after wipe', await db.drain())

  deepEqual(await db.query('x').range(0, 10).get().toObject(), [
    { id: 1, age: 0, name: '', a: '' },
    { id: 2, age: 1, name: '', a: '' },
    { id: 3, age: 2, name: '', a: '' },
    { id: 4, age: 3, name: '', a: '' },
    { id: 5, age: 4, name: '', a: '' },
    { id: 6, age: 5, name: '', a: '' },
    { id: 7, age: 6, name: '', a: '' },
    { id: 8, age: 7, name: '', a: '' },
    { id: 9, age: 8, name: '', a: '' },
    { id: 10, age: 9, name: '', a: '' },
  ])

  const arr = new Array(2e6).fill(0)
  const arr2 = new Array(2e6).fill(0)

  const buf1 = Buffer.from(arr)
  const buf2 = Buffer.from(arr2)
  const amount = 1e5
  let d = performance.now()
  let cnt = 0
  for (let i = 0; i < amount; i++) {
    if (buf1.equals(buf2)) {
      cnt++
    }
  }

  console.log(performance.now() - d, 'ms', cnt)

  const a = new Uint8Array(arr)
  const b = new Uint8Array(arr2)

  // const a = new BigUint64Array(a1.buffer)
  // const b = new BigUint64Array(b1.buffer)

  // const eq = (a, b) => {
  //   // const a = new BigUint64Array(a1.buffer)
  //   // const b = new BigUint64Array(b1.buffer)
  //   const len = a.length
  //   if (len != b.length) {
  //     return false
  //   }
  //   let i = 0
  //   while (i < len) {
  //     if (a[i] != b[i]) {
  //       return false
  //     }
  //     i++
  //   }
  //   return true
  // }

  d = performance.now()
  cnt = 0

  // global.gc()

  for (let i = 0; i < amount; i++) {
    if (equals(a, b)) {
      cnt++
    }
  }

  console.log(equals(a, b))

  console.log(performance.now() - d, 'ms', cnt)
})
