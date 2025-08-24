import { BasedDb, convertToReaderSchema, resultToObject } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { italy } from './shared/examples.js'
import { wait } from '@based/utils'
import { deflateSync } from 'node:zlib'

await test('meta for selva string', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  // t.after(() => db.stop())

  await db.setSchema({
    locales: {
      en: {},
      it: {},
    },
    types: {
      item: {
        props: {
          name: 'string',
          body: 'text',
          email: { maxBytes: 20, type: 'string' }, // fix main prop
          items: {
            items: {
              ref: 'item',
              prop: 'items',
              $edgeName: 'string',
            },
          },
        },
      },
    },
  })

  const id1 = await db.create('item', {
    name: 'a',
    email: 'a@b.com',
    body: {
      it: 'it',
      en: 'en',
    },
  })

  await db
    .query('item')
    .include('name', { meta: 'only' })
    .get()
    .inspect(10, true)

  deepEqual(await db.query('item').include('name', { meta: true }).get(), [
    {
      id: 1,
      name: {
        value: 'a',
        checksum: 6819207186481153,
        size: 1,
        crc32: 3251651376,
        compressed: false,
      },
    },
  ])

  await db.create('item', {})

  deepEqual(await db.query('item').include('name', { meta: true }).get(), [
    {
      id: 1,
      name: {
        value: 'a',
        checksum: 6819207186481153,
        size: 1,
        crc32: 3251651376,
        compressed: false,
      },
    },
    {
      id: 2,
      name: { checksum: 0, size: 0, crc32: 0, compressed: false, value: '' },
    },
  ])

  deepEqual(await db.query('item').include('name', { meta: 'only' }).get(), [
    {
      id: 1,
      name: {
        checksum: 6819207186481153,
        size: 1,
        crc32: 3251651376,
        compressed: false,
      },
    },
    {
      id: 2,
      name: { checksum: 0, size: 0, crc32: 0, compressed: false },
    },
  ])

  db.update('item', 1, {
    items: [
      {
        id: 2,
        $edgeName: 'a',
      },
    ],
  })

  deepEqual(
    await db.query('item').include('items.$edgeName', { meta: 'only' }).get(),
    [
      {
        id: 1,
        items: [
          {
            id: 2,
            $edgeName: {
              checksum: 6819207186481153,
              size: 1,
              crc32: 3251651376,
              compressed: false,
            },
          },
        ],
      },
      {
        id: 2,
        items: [
          {
            id: 1,
            $edgeName: {
              checksum: 6819207186481153,
              size: 1,
              crc32: 3251651376,
              compressed: false,
            },
          },
        ],
      },
    ],
    'Edge meta',
  )

  deepEqual(await db.query('item').include('email', { meta: 'only' }).get(), [
    {
      id: 1,
      email: {
        checksum: 3032276847820807,
        size: 7,
        crc32: 1445902275,
        compressed: false,
      },
    },
    {
      id: 2,
      email: { checksum: 0, size: 0, crc32: 0, compressed: false },
    },
  ])

  deepEqual(await db.query('item').include('email', { meta: true }).get(), [
    {
      id: 1,
      email: {
        checksum: 3032276847820807,
        size: 7,
        crc32: 1445902275,
        compressed: false,
        value: 'a@b.com',
      },
    },
    {
      id: 2,
      email: { checksum: 0, size: 0, crc32: 0, compressed: false, value: '' },
    },
  ])

  await db.update('item', 1, { name: italy })

  deepEqual(await db.query('item').include('name', { meta: true }).get(), [
    {
      id: 1,
      name: {
        checksum: 1734243019465138,
        size: 74162,
        crc32: 826951513,
        compressed: true,
        value: italy,
      },
    },
    {
      id: 2,
      name: { checksum: 0, size: 0, crc32: 0, compressed: false, value: '' },
    },
  ])

  deepEqual(await db.query('item').include('body', { meta: true }).get(), [
    {
      id: 1,
      body: {
        en: {
          checksum: 7931262287216642,
          size: 2,
          crc32: 3781920570,
          compressed: false,
          value: 'en',
        },
        it: {
          checksum: 2578600672886786,
          size: 2,
          crc32: 1229572617,
          compressed: false,
          value: 'it',
        },
      },
    },
    {
      id: 2,
      body: {
        en: { checksum: 0, size: 0, crc32: 0, compressed: false, value: '' },
        it: { checksum: 0, size: 0, crc32: 0, compressed: false, value: '' },
      },
    },
  ])

  await db.update('item', 2, {
    body: {
      en: 'English!',
    },
  })

  deepEqual(
    await db.query('item').include('body', { meta: true }).get(),
    [
      {
        id: 1,
        body: {
          en: {
            checksum: 7931262287216642,
            size: 2,
            crc32: 3781920570,
            compressed: false,
            value: 'en',
          },
          it: {
            checksum: 2578600672886786,
            size: 2,
            crc32: 1229572617,
            compressed: false,
            value: 'it',
          },
        },
      },
      {
        id: 2,
        body: {
          en: {
            checksum: 5708264572452872,
            size: 8,
            crc32: 2721912657,
            compressed: false,
            value: 'English!',
          },
          it: { checksum: 0, size: 0, crc32: 0, compressed: false, value: '' },
        },
      },
    ],
    'text all meta + value',
  )

  deepEqual(
    await db.query('item').include('body', { meta: 'only' }).get(),
    [
      {
        id: 1,
        body: {
          en: {
            checksum: 7931262287216642,
            size: 2,
            crc32: 3781920570,
            compressed: false,
          },
          it: {
            checksum: 2578600672886786,
            size: 2,
            crc32: 1229572617,
            compressed: false,
          },
        },
      },
      {
        id: 2,
        body: {
          en: {
            checksum: 5708264572452872,
            size: 8,
            crc32: 2721912657,
            compressed: false,
          },
          it: { checksum: 0, size: 0, crc32: 0, compressed: false },
        },
      },
    ],
    'text all meta only ',
  )

  deepEqual(
    await db.query('item').include('body', { meta: 'only' }).locale('it').get(),
    [
      {
        id: 1,
        body: {
          checksum: 2578600672886786,
          size: 2,
          crc32: 1229572617,
          compressed: false,
        },
      },
      {
        id: 2,
        body: { checksum: 0, size: 0, crc32: 0, compressed: false },
      },
    ],
  )

  deepEqual(
    await db.query('item').include('body', { meta: 'only' }).locale('en').get(),
    [
      {
        id: 1,
        body: {
          checksum: 7931262287216642,
          size: 2,
          crc32: 3781920570,
          compressed: false,
        },
      },
      {
        id: 2,
        body: {
          checksum: 5708264572452872,
          size: 8,
          crc32: 2721912657,
          compressed: false,
        },
      },
    ],
  )
})
