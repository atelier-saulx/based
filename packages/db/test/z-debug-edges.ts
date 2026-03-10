import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import fs from 'node:fs'

await test('edges migration', async (t) => {
  const db = new BasedDb({ path: t.tmp })

  await db.start({ clean: true })

  t.after(() => t.backup(db))
  const edges = {
    $position: ['overviewTab'],
    $nr: 'number',
    $str: 'string',
    $status: ['read', 'new'],
    $role: ['owner', 'participant', 'applicant'],
    $positionIndex: 'number',
    $adminSince: 'timestamp',
    $seen: 'boolean',
  } as any
  await db.setSchema({
    types: {
      a: {
        bRefs: {
          items: {
            ref: 'b',
            prop: 'aRefs',
            ...edges,
          },
        },
        name: 'string',
      },
      b: {
        aRefs: {
          items: {
            ref: 'a',
            prop: 'bRefs',
            ...edges,
          },
        },
        name: 'string',
      },
    },
  })
  const n = 100_000
  {
    let i = n
    while (i--) {
      db.create('a')
      db.create('b')
    }
  }
  {
    let i = n
    while (i) {
      db.update('a', i, {
        bRefs: [
          {
            id: i,
            $position: 'overviewTab',
            $nr: i,
            $str: String(i),
            $status: ['read', 'new'][i % 2],
            $role: ['owner', 'participant', 'applicant'][i % 3],
            $positionIndex: i,
            $adminSince: new Date(i).getTime(),
            $seen: !!i,
          },
        ],
      })
      i--
    }
  }

  const a1 = await db.query('a').range(0, n).include('*', '**').get().toObject()
  await db.setSchema({
    types: {
      b: {
        name: 'string',
        aRefs: {
          items: {
            ref: 'a',
            prop: 'bRefs',
            ...edges,
          },
        },
      },
      a: {
        name: 'string',
        bRefs: {
          items: {
            ref: 'b',
            prop: 'aRefs',
            ...edges,
          },
        },
      },
    },
  })

  const a2 = await db.query('a').range(0, n).include('*', '**').get().toObject()
  // console.log(a1[0])
  // console.log('---')
  // console.log(a2[0])
  a1.forEach((item1, index) => deepEqual(item1, a2[index]))
})
