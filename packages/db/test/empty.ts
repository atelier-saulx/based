import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('empty db and no schema', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await db.save()
})

await test('empty db and no nodes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          file: { type: 'binary' },
        },
      },
    },
  })
  await db.save()
})

await test('empty db and deleted nodes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          file: { type: 'binary' },
        },
      },
    },
  })

  const res = await db.create('user', {
    file: new Uint8Array([1, 3, 3, 7])
  })
  await db.delete('user', res)

  await db.save()

  const res1 = await db.create('user', {
    file: new Uint8Array([1, 3, 3, 7])
  })
  await db.save()
  await db.delete('user', res1)
  await db.save()
})
