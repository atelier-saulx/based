import { combineToNumber, readUint32, wait, writeUint32 } from '@based/utils'
import { registerQuery } from '../../src/client/query/registerQuery.js'
import { BasedDb } from '../../src/index.js'
import native from '../../src/native.js'
import test from '../shared/test.js'
import { perf } from '../shared/assert.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))
  // t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          nr: 'uint32',
          // flap: { type: 'string', compression: 'none' },
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      nr: i,
      name: 'Mr poop',
    })
  }

  console.log('start query')

  await db.drain()
  ;(await db.query('user').include('name').range(0, 1).get()).debug()

  await perf(
    async () => {
      const q: any[] = []
      for (let i = 0; i < 1000; i++) {
        q.push(
          db
            .query('user')
            .include('name')
            .range(0, 1e6 + i)
            .get(),
        )
      }
      await Promise.all(q)
    },
    'Nodes',
    { repeat: 10 },
  )

  console.log('done')

  await wait(100)
})
