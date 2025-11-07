import test from '../shared/test.js'
import { BasedDb } from '../../src/index.js'
import { randomString, wait } from '@based/utils'
import { Schema } from '@based/schema'

await test('schema problems save', async (t) => {
  let db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  await db.save()

  const types: Schema['types'] = {}

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

  types[type] = Object.assign(types[type], {
    myRef: {
      ref: 'seq',
      prop: 'votes',
    },
  })

  types.seq = {
    votes: {
      items: {
        ref: type,
        prop: 'myRef',
      },
    },
  }

  await db.setSchema({
    locales: { en: {} },
    types,
  })

  const seqId = await db.create('seq', {})

  for (let i = 0; i < 1e5; i++) {
    await db.create(type, {
      blurf: '213123 ' + i,
    })
  }

  const id = await db.create(type, {
    blurf: '213123',
  })

  let update = 0
  const int2 = setInterval(async () => {
    if (db) {
      update++
      await db.schemaIsSet()
      if (update % 5 === 0) {
        await db.create(type, {
          blurf: randomString(1000),
        })
      }
      await db.update(type, id, {
        blurf: randomString(1000),
        myRef: seqId,
      })
    }
  }, 10)

  const int = setInterval(async () => {
    let d = db
    db = null
    await d.save()
    await d.stop()
    d = new BasedDb({
      path: t.tmp,
    })
    await d.start()
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
