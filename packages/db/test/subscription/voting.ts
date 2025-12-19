import { wait } from '@based/utils'
import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { equal } from '../shared/assert.js'

await test('sub-voting', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  db.server.subscriptions.subInterval = 1
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      edition: {
        name: 'string',
        body: 'string',
      },
    },
  })

  const id = await db.create('edition', {
    name: 'xxx',
    body: 'yyy',
  })
  let a = 0
  let b = 0
  let c = 0
  let d = 0
  let unsub1 = db.query('edition', id).subscribe(() => {
    a++
  })
  let unsub2 = db
    .query('edition', id)
    .include('body')
    .subscribe(() => {
      b++
    })

  await wait(300)
  await db.update('edition', id, {
    body: 'z1',
  })
  await wait(300)
  await db.update('edition', id, {
    body: 'z2',
  })
  await wait(300)
  await db.update('edition', id, {
    body: 'z3',
  })

  unsub1()
  unsub2()
  await wait(300)
  equal(a, 3, 'a')
  equal(b, 3, 'b')
  unsub1 = db.query('edition', id).subscribe(() => {
    c++
  })

  unsub2 = db
    .query('edition', id)
    .include('body')
    .subscribe(() => {
      d++
    })

  await wait(300)
  await db.update('edition', id, {
    body: 'z1',
  })
  await wait(300)
  await db.update('edition', id, {
    body: 'z2',
  })
  await wait(300)
  await db.update('edition', id, {
    body: 'z3',
  })
  await wait(300)
  equal(a, 3, 'a')
  equal(b, 3, 'b')
  equal(c, 4, 'c')
  equal(d, 4, 'd')
  console.log({ a, b, c, d })
})
