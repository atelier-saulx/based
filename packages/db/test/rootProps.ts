import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('rootProps', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  db.putSchema({
    props: {
      myString: 'string',
      myBoolean: 'boolean',
    },
  })

  const rootData = {
    myString: 'im the root',
    myBoolean: true,
  }
  await db.update(rootData)

  const rootRes = (await db.query().get()).toObject()

  deepEqual(rootRes, { id: 1, ...rootData })
})
