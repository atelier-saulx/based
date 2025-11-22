import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { perf } from './shared/assert.js'

await test('create 1m 2char strings', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      test: {
        string: 'string',
      },
    },
  })

  const string = 'aa'

  await perf(async () => {
    let i = 1000_000
    while (i--) {
      db.create('test', { string })
    }
    await db.drain()
  }, '2char strings')
})

await test('create 1m 1000char strings', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      test: {
        string: 'string',
      },
    },
  })

  const string = Array.from({ length: 1000 }).fill('a').join()

  await perf(async () => {
    let i = 1000_000
    while (i--) {
      db.create('test', { string })
    }
    await db.drain()
  }, '1000char strings')
})
