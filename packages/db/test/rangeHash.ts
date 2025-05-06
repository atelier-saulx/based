import fs from 'node:fs/promises';
import path from 'node:path';
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

const f = (v) => v.map((r) => r.hash)

await test('isomorphic types have equal hashes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      article: {
        title: 'string',
        body: 'string',
      },
      story: {
        title: 'string',
        body: 'string',
      },
    },
  })

  for (let i = 0; i < 200_000; i++) {
    await db.create('article', {
      title: 'party in the house',
      body: 'there was',
    })
    await db.create('story', {
      title: 'party in the house',
      body: 'there was',
    })
  }

  await db.save()
  deepEqual((await db.query('article').get()).checksum, (await db.query('story').get()).checksum)
  const { rangeDumps } = JSON.parse((await fs.readFile(path.join(t.tmp, 'writelog.json'))).toString())
  deepEqual(f(rangeDumps['2']), f(rangeDumps['3']))
})

// The result might be unexpected but 'cardinality' and 'string' are stored the same way
await test('small diff in schema', async (t) => {
  const db1 = new BasedDb({
    path: path.join(t.tmp, 'db1'),
  })
  const db2 = new BasedDb({
    path: path.join(t.tmp, 'db2'),
  })
  await db1.start({ clean: true })
  t.after(() => db1.destroy())
  await db2.start({ clean: true })
  t.after(() => db2.destroy())

  await db1.setSchema({
    types: {
      item: {
        title: 'string',
        score: 'string',
      },
    },
  })
  await db2.setSchema({
    types: {
      item: {
        title: 'string',
        score: 'cardinality',
      },
    },
  })

  await db1.create('item', {
    title: 'haha',
  })
  await db2.create('item', {
    title: 'haha',
  })

  await db1.save()
  await db2.save()
  const { rangeDumps: rangeDumps1 } = JSON.parse((await fs.readFile(path.join(t.tmp, 'db1', 'writelog.json'))).toString())
  const { rangeDumps: rangeDumps2 } = JSON.parse((await fs.readFile(path.join(t.tmp, 'db2', 'writelog.json'))).toString())
  deepEqual(f(rangeDumps1['2']), f(rangeDumps2['2']))
})
