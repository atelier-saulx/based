import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import fs from 'node:fs'

await test('edges migration', async (t) => {
  const db = new BasedDb({ path: t.tmp })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      a: {
        bRefs: {
          items: {
            ref: 'b',
            prop: 'aRefs',
            $nr: 'number',
          },
        },
        name: 'string',
      },
      b: {
        aRefs: {
          items: {
            ref: 'a',
            prop: 'bRefs',
            $nr: 'number',
          },
        },
        name: 'string',
      },
    },
  })

  {
    let i = 1000
    while (i--) {
      db.create('a')
      db.create('b')
    }
  }
  {
    let i = 1000
    while (i) {
      db.update('a', i, { bRefs: [{ id: i, $nr: i }] })
      i--
    }
  }

  const a1 = await db.query('a').include('*', '**').get().toObject()
  await db.setSchema({
    types: {
      b: {
        name: 'string',
        aRefs: {
          items: {
            ref: 'a',
            prop: 'bRefs',
            $nr: 'number',
          },
        },
      },
      a: {
        name: 'string',
        bRefs: {
          items: {
            ref: 'b',
            prop: 'aRefs',
            $nr: 'number',
          },
        },
      },
    },
  })

  const a2 = await db.query('a').include('*', '**').get().toObject()
  a1.forEach((item1, index) => deepEqual(item1, a2[index]))
})
