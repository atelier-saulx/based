import { setTimeout } from 'timers/promises'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test.skip('mixed', async (t) => {
  try {
    // const populate = await import('./shared/tmp/populate/index.js')
    const db = new BasedDb({
      path: t.tmp,
    })

    await db.start({ clean: true })

    t.after(() => t.backup(db))

    //    await populate.default(db)
    await setTimeout(1e3)
    await db.update('phase', 1, {
      scenarios: {
        add: [
          {
            id: 1,
            $sequence: 1,
          },
        ],
      },
    })
    await setTimeout(1e3)
  } catch (e) {
    console.info('skipping mixed test')
  }
})
