import assert, { equal } from 'node:assert'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import test from '../shared/test.js'
import native from '../../src/native.js'
import { deepEqual } from '../shared/assert.js'
import { DbServer } from '../../src/sdk.js'
import { getBlockHash } from '../../src/db-server/blocks.js'
import { checksum } from '../../src/db-query/query/index.js'
import { testDbClient } from '../shared/index.js'

const sha1 = async (path: string) =>
  createHash('sha1')
    .update(await fs.readFile(path))
    .digest('hex')

await test('isomorphic types have equal hashes', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const schema = {
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
  } as const
  const client = await testDbClient(db, schema)

  for (let i = 0; i < 200_000; i++) {
    client.create('article', {
      title: 'party in the house',
      body: 'there was',
    })
    client.create('story', {
      title: 'party in the house',
      body: 'there was',
    })
  }
  await client.drain()

  deepEqual(
    checksum(await client.query('article').get()),
    checksum(await client.query('story').get()),
  )
  assert(
    native.equals(await getBlockHash(db, 1, 1), await getBlockHash(db, 2, 1)),
  )
})

// The result might be unexpected but 'cardinality' and 'string' are stored the same way
await test('small diff in schema', async (t) => {
  const db1 = new DbServer({
    path: path.join(t.tmp, 'db1'),
  })
  const db2 = new DbServer({
    path: path.join(t.tmp, 'db2'),
  })
  await db1.start({ clean: true })
  t.after(() => db1.destroy())
  await db2.start({ clean: true })
  t.after(() => db2.destroy())

  const client1 = await testDbClient(db1, {
    types: {
      item: {
        title: 'string',
        score: 'string',
      },
    },
  })
  const client2 = await testDbClient(db2, {
    types: {
      item: {
        title: 'string',
        score: 'cardinality',
      },
    },
  })

  await client1.create('item', {
    title: 'haha',
  })
  await client2.create('item', {
    title: 'haha',
  })

  await db1.save()
  await db2.save()

  equal(
    await sha1(path.join(t.tmp, 'db1', '1_0.sdb')),
    await sha1(path.join(t.tmp, 'db2', '1_0.sdb')),
  )
})

await test('ref dst type change', async (t) => {
  const db1 = new DbServer({
    path: path.join(t.tmp, 'db1'),
  })
  const db2 = new DbServer({
    path: path.join(t.tmp, 'db2'),
  })
  await db1.start({ clean: true })
  t.after(() => db1.destroy())
  await db2.start({ clean: true })
  t.after(() => db2.destroy())

  const client1 = await testDbClient(db1, {
    types: {
      a: {
        title: 'string',
        other: { ref: 'a', prop: 'other' },
      },
      b: {
        title: 'string',
        other: { ref: 'b', prop: 'other' },
      },
    },
  })
  const client2 = await testDbClient(db2, {
    types: {
      a: {
        title: 'string',
        other: { ref: 'b', prop: 'other' },
      },
      b: {
        title: 'string',
        other: { ref: 'a', prop: 'other' },
      },
    },
  })

  const db1a1 = await client1.create('a', {
    title: 'haha',
  })
  await client1.create('a', {
    title: 'haha',
    other: db1a1,
  })
  const db1b1 = await client1.create('b', {
    title: 'haha',
  })
  await client1.create('b', {
    title: 'haha',
    other: db1b1,
  })

  const db2a1 = await client2.create('a', {
    title: 'haha',
  })
  const db2a2 = await client2.create('a', {
    title: 'haha',
  })
  await client2.create('b', {
    title: 'haha',
    other: db2a2,
  })
  await client2.create('b', {
    title: 'haha',
    other: db2a1,
  })

  await db1.save()
  await db2.save()
  equal(
    await sha1(path.join(t.tmp, 'db1', '2_0.sdb')),
    await sha1(path.join(t.tmp, 'db2', '2_0.sdb')),
  )
})
