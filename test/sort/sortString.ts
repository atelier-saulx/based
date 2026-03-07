import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { testDb, testDbClient, testDbServer } from '../shared/index.js'
import { deepEqual, equal, isSorted } from '../shared/assert.js'
import { text } from '../shared/examples.js'
import { randomString } from '../../src/utils/index.js'

await test('compression / large strings', async (t) => {
  const testCase = async (
    name: string,
    opts: {
      value?: string
      random?: number
      amount?: number
      compression?: boolean
    } = {},
  ) => {
    const len = opts.amount ?? 5
    const random = opts.random ?? 0
    const value = opts.value ?? ''
    const server = await testDbServer(t, { noBackup: true })
    const db = await testDbClient(server, {
      types: {
        article: {
          props: {
            name: { type: 'string' },
            article: {
              type: 'string',
              compression: opts.compression != false ? 'deflate' : 'none',
            },
            nr: { type: 'uint32' },
          },
        },
      },
    })

    const results: { id: number; nr: number; article: string; name: string }[] =
      []
    for (let i = 0; i < len; i++) {
      const n = ~~(Math.random() * 9)
      const article =
        n +
        ' ' +
        ~~(Math.random() * 9) +
        (random ? randomString(random, { noSpecials: true }) : '') +
        value +
        i
      const p: any = {
        name: 'Article ' + n,
        article: article,
        nr: n,
      }
      p.id = Number(db.create('article', p))
      results.push(p)
    }
    // const dbTime = await db.drain()
    // equal(dbTime < 1000, true, 'db modify should not take longer then 1s')
    let d = Date.now()
    let siTime = Date.now() - d
    equal(
      siTime < 500,
      true,
      name + ' creating string sort index should not take longer then 500ms',
    )
    deepEqual(
      await db
        .query('article')
        .include('name', 'article', 'nr')
        .sort('article')
        .range(0, len)
        .get()
        .then((v) => v.map((v) => v.nr)),
      results.sort((a, b) => a.nr - b.nr).map((v) => v.nr),
      name,
    )

    deepEqual(
      await db
        .query('article')
        .include('name', 'article', 'nr')
        .sort('article')
        .order('desc')
        .range(0, len)
        .get()
        .then((v) => v.map((v) => v.nr)),
      results.sort((b, a) => a.nr - b.nr).map((v) => v.nr),
      name + ' desc',
    )

    await db.update('article', 1, {
      name: 5 + ' cool',
      article:
        5 +
        ' ' +
        ~~(Math.random() * 9) +
        (random ? randomString(random, { noSpecials: true }) : '') +
        value +
        5,
      nr: 5,
    })

    const items = await db
      .query('article')
      .include('article')
      .sort('article')
      .get()

    isSorted(items, 'article')

    await db.delete('article', 5)

    const items2 = await db
      .query('article')
      .include('article')
      .sort('article')
      .get()

    equal(items2.length, items.length - 1)
    isSorted(items2, 'article')

    await server.destroy()
    db.destroy()
  }

  await testCase('short strings')

  await testCase('10 len random strings', {
    random: 10,
  })

  await testCase('32 len random strings', {
    random: 32,
  })

  await testCase('large string uncompressed', {
    value: text,
    compression: false,
  })

  await testCase('large string compressed', {
    value: text,
  })

  await testCase('large string compressed randomized', {
    value: text,
    random: 32,
  })
})

await test('fixed len strings', async (t) => {
  const db = await testDb(t, {
    types: {
      article: {
        props: {
          name: { type: 'string', maxBytes: 20 },
          nr: { type: 'uint32' },
        },
      },
    },
  })

  for (let i = 0; i < 10; i++) {
    db.create('article', {
      name: i + ' flap',
      nr: i,
    })
  }

  isSorted(
    await db
      .query('article')
      .include('name', 'nr')
      .sort('name')
      .order('desc')
      .get(),
    'name',
    'desc',
  )

  await db.update('article', 1, {
    name: 5 + ' cool',
    nr: 5,
  })

  isSorted(
    await db
      .query('article')
      .include('name', 'nr')
      .sort('name')
      .order('desc')
      .get(),
    'name',
    'desc',
  )
})
