import { BasedDb } from '../../src/db.js'
import test from '../shared/test.js'
import { deepEqual, equal, perf } from '../shared/assert.js'

await test('await updates', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const status = ['a', 'b', 'c', 'd', 'e', 'f']

  await db.setSchema({
    types: {
      user: {
        props: {
          externalId: { type: 'alias' },
          status,
        },
      },
    },
  })

  const total = 10e6

  for (let i = 0; i < total; i++) {
    db.create('user', {
      externalId: i + '-alias',
      status: 'a',
    })
  }

  await db.isModified()

  let totalAlias = 0

  const updateAlias = async () => {
    const externalId = Math.ceil(Math.random() * total) + '-alias'
    const id = Math.ceil(Math.random() * total)
    await db.update('user', id, {
      externalId,
    })
    totalAlias++
  }

  //let lastMeasure = performance.now()
  let i = 0
  await perf(
    async () => {
      await updateAlias()
      if (!(i % 10_000)) {
        //const opsPerS = totalAlias / ((performance.now() - lastMeasure) / 1e3)
        //console.log(`${~~opsPerS} per sec`)
        //lastMeasure = performance.now()
        totalAlias = 0
      }
      i++
    },
    'update alias',
    { repeat: 100_000 },
  )
  // should be smaller then 5s
})
