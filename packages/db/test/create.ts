import test from './shared/test.js'
import { BasedDb } from '../src/index.js'

test('better create', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  const res = db.create('user', {
    name: 'youri',
    email: 'power@magic.nl',
  })

  await db.drain()
  const res2 = db.create('user', {
    friend: res,
  })
})
