import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test.skip('idOffset', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 200,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
    types: {
      thing: {
        props: {
          name: 'string',
        },
      },
    },
  })
})
