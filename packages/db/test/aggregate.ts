import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test.skip('aggregate', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 100,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      vote: {
        props: {
          country: 'string',
          ddi1: 'uint32',
          ddi2: 'uint32',
          ddi3: 'uint32',
          ddi4: 'uint32',
          ddi5: 'uint32',
          ddi6: 'uint32',
          ddi7: 'uint32',
          ddi8: 'uint32',
          ddi9: 'uint32',
          ddi10: 'uint32',
          ddi11: 'uint32',
          ddi12: 'uint32',
          ddi13: 'uint32',
          ddi14: 'uint32',
          ddi15: 'uint32',
          ddi16: 'uint32',
          ddi17: 'uint32',
          ddi18: 'uint32',
          ddi19: 'uint32',
          ddi20: 'uint32',
        },
      },
    },
  })

  // db.query('vote')
  //   .group('country')
  //   .sum('ddi1', 'ddi2', 'ddi3', 'ddi4')
  //   .mean('ddi1', 'ddi2', 'ddi3', 'ddi4')
})
