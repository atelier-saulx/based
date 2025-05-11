import test from './shared/test.js'
import { BasedDb } from '../src/index.js'
import { clientWorker } from './shared/startWorker.js'
import { equal } from './shared/assert.js'
import { randomString, wait } from '@saulx/utils'
import { randomInt } from 'node:crypto'

await test('schema problems modify', async (t) => {
  let db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  const types = {}

  for (let i = 0; i < 50; i++) {
    types[(~~(Math.random() * 1e6)).toString(16)] = {
      blurf: 'string',
      flap: 'uint32',
      gurk: 'text',
      snak: 'string',
      gook: 'alias',
      gorgor: 'timestamp',
    }
  }

  const keys = Object.keys(types)
  const type = keys[3]

  await db.setSchema({
    types,
  })

  for (let i = 0; i < 1e5; i++) {
    await db.create(type, {
      blurf: '213123 ' + i,
    })
  }

  const id = await db.create(type, {
    blurf: '213123',
  })

  const int2 = setInterval(async () => {
    if (db) {
      await db.schemaIsSet()
      await db.update(type, id, {
        blurf: randomString(1000),
      })
    }
  }, 10)

  const int = setInterval(async () => {
    console.log('stop')
    let d = db
    db = null
    await d.save()
    await d.stop()
    d = new BasedDb({
      path: t.tmp,
    })
    await d.start({ clean: true })
    db = d
  }, 1e3)

  const q = []

  await Promise.all(q)

  await wait(20e3)
  clearInterval(int)
  clearInterval(int2)
  await wait(1e3)

  if (db) {
    return db.destroy()
  }
})
