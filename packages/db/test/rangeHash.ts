import fs from 'node:fs/promises';
import path from 'node:path';
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

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
  const f = (v) => v.map((r) => r.hash)
  deepEqual(f(rangeDumps['2']), f(rangeDumps['3']))
})
