import { BasedDb } from '../src/db.js'
import test from './shared/test.js'

// Some externals can cause issues with GC and the event loop.
// Previously letting the db ref go caused a stall even if the instance was
// technically destroyed.
await test('db should get cleaned', async (t) => {
  let db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())
  const reload = async () => {
    await db.drain()
    await db.save()
    const db2 = new BasedDb({
      path: t.tmp,
    })
    await db2.start({ noLoadDumps: true })
    t.after(() => db2.destroy())
    db = db2
  }
})
