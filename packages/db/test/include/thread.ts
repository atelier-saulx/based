import { wait } from '@based/utils'
import { registerQuery } from '../../src/client/query/registerQuery.js'
import { BasedDb } from '../../src/index.js'
import native from '../../src/native.js'
import test from '../shared/test.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          nr: 'uint32',
        },
      },
    },
  })

  const id = await db.create('user', {
    nr: 2,
  })

  const q = db.query('user', id)
  registerQuery(q)
  // maybe expose regisrer query on class

  const buf = q.buffer

  console.log({ id, buf })

  for (let i = 0; i < 4; i++) {
    native.getQueryBufThread(buf, db.server.dbCtxExternal)
  }

  await wait(10000)
})
