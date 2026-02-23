import { testDb } from './test/shared/index.js'

async function run() {
  const db = null as any as Awaited<ReturnType<typeof testDb>>
  const a = await db.query2('vote').include('country', 'AU').get()

  const b = await db
    .query2('vote')
    .include((q) => q('sequence'))
    .get()

  const c = await db
    .query2('vote')
    .include('country', 'AU', (q) => q('sequence'))
    .get()
}
