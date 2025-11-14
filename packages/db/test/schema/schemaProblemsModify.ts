import test from '../shared/test.ts'
import { BasedDb } from '../../src/index.ts'
import { clientWorker } from '../shared/startWorker.ts'

await test('schema problems modify', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  const int = setInterval(async () => {
    await db.save()
  }, 1e3)

  t.after(() => {
    clearInterval(int)
    return t.backup(db)
  })

  await db.start({ clean: true })

  const types = {}
  for (let i = 0; i < 200; i++) {
    types[(~~(Math.random() * 1e6)).toString(16)] = {
      blurf: 'string',
      flap: 'uint32',
      gurk: 'text',
      snak: 'string',
      gook: 'alias',
      gorgor: 'timestamp',
    }
  }

  const bla = Object.keys(types)

  await db.setSchema({
    locales: { en: {} },
    types,
  })

  const q = []

  q.push(
    clientWorker(
      t,
      db,
      async (c, { bla }) => {
        await c.schemaIsSet()
        c.flushTime = 0
        await new Promise((resolve) => setTimeout(resolve, 600))
        for (let i = 0; i < 1e5; i++) {
          await c.create(bla[~~(Math.random() * bla.length)], {
            flap: i,
            gook: `boinkx${i}@boik.com`,
            gorgor: 1,
          })
        }
        await c.drain()
      },
      { bla },
    ).catch((err) => {}),
  )

  await Promise.all(q)
})
