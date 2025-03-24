import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('simple', async (t) => {
  const db = new BasedDb({
    path: '/Users/hbp/repos/based-db/packages/db/tmp',
  })

  await db.start({ })
  t.after(() => {
    return db.destroy()
  })
  db.save({ forceFullDump: true })
  console.log('DUMP DONE')

  const db2 = new BasedDb({
    path: '/Users/hbp/repos/based-db/packages/db/tmp',
  })
  t.after(() => {
    return db2.destroy()
  })
  await db2.start()
})
