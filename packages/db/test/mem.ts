import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('mem', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      data: {
        props: {
          a: {
            type: 'vector',
            size: 5,
          },
          age: { type: 'uint32' },
          name: { type: 'string', maxBytes: 10 },
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('data', {
      age: i,
    })
  }

  // high frequencty of removev and creates
})
