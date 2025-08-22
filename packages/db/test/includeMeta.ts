import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { italy } from './shared/examples.js'

await test('meta for selva string', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    // add [en,it]
    locales: { en: {}, it: { fallback: 'en' } },
    types: {
      item: {
        props: {
          x: 'uint32',
          // email: { type: 'string', maxBytes: 10 },
          name: 'string',
          flap: 'text',
          // derp: {
          //   props: {
          //     x: 'string',
          //   },
          // },
          // items: {
          //   items: {
          //     ref: 'item',
          //     prop: 'items',
          //     $edgeName: 'string',
          //   },
          // },
        },
      },
    },
  })

  const id1 = await db.create('item', {
    name: 'a',
    flap: { en: 'a', it: 'b' },
    // email: 'a@b.com',
    x: 100,
  })

  console.log('derp')

  // await (await db.query('item').include('name', 'x').get()).debug()

  await db.query('item').include('name', 'flap', 'x').get().inspect()

  // console.log(
  //   'xx',
  //   await db.query('item').include('name', { meta: true }).get(),
  // )

  // await db
  //   .query('item')
  //   .include('name', { meta: 'only' })
  //   .get()
  //   .inspect(10, true)

  // deepEqual(await db.query('item').include('name', { meta: true }).get(), [
  //   {
  //     id: 1,
  //     name: {
  //       value: 'a',
  //       checksum: 6819207186481153,
  //       size: 1,
  //       crc32: 3251651376,
  //       compressed: false,
  //     },
  //   },
  // ])

  // await db.create('item', {})

  // deepEqual(await db.query('item').include('name', { meta: true }).get(), [
  //   {
  //     id: 1,
  //     name: {
  //       value: 'a',
  //       checksum: 6819207186481153,
  //       size: 1,
  //       crc32: 3251651376,
  //       compressed: false,
  //     },
  //   },
  //   {
  //     id: 2,
  //     name: { checksum: 0, size: 0, crc32: 0, compressed: false, value: '' },
  //   },
  // ])

  // deepEqual(await db.query('item').include('name', { meta: 'only' }).get(), [
  //   {
  //     id: 1,
  //     name: {
  //       checksum: 6819207186481153,
  //       size: 1,
  //       crc32: 3251651376,
  //       compressed: false,
  //     },
  //   },
  //   {
  //     id: 2,
  //     name: { checksum: 0, size: 0, crc32: 0, compressed: false },
  //   },
  // ])

  // db.update('item', 1, {
  //   items: [
  //     {
  //       id: 2,
  //       $edgeName: 'a',
  //     },
  //   ],
  // })

  // deepEqual(
  //   await db.query('item').include('items.$edgeName', { meta: 'only' }).get(),
  //   [
  //     {
  //       id: 1,
  //       items: [
  //         {
  //           id: 2,
  //           $edgeName: {
  //             checksum: 6819207186481153,
  //             size: 1,
  //             crc32: 3251651376,
  //             compressed: false,
  //           },
  //         },
  //       ],
  //     },
  //     {
  //       id: 2,
  //       items: [
  //         {
  //           id: 1,
  //           $edgeName: {
  //             checksum: 6819207186481153,
  //             size: 1,
  //             crc32: 3251651376,
  //             compressed: false,
  //           },
  //         },
  //       ],
  //     },
  //   ],
  //   'Edge meta',
  // )

  // deepEqual(await db.query('item').include('email', { meta: 'only' }).get(), [
  //   {
  //     id: 1,
  //     email: {
  //       checksum: 3032276847820807,
  //       size: 7,
  //       crc32: 1445902275,
  //       compressed: false,
  //     },
  //   },
  //   {
  //     id: 2,
  //     email: { checksum: 0, size: 0, crc32: 0, compressed: false },
  //   },
  // ])

  // deepEqual(await db.query('item').include('email', { meta: true }).get(), [
  //   {
  //     id: 1,
  //     email: {
  //       checksum: 3032276847820807,
  //       size: 7,
  //       crc32: 1445902275,
  //       compressed: false,
  //       value: 'a@b.com',
  //     },
  //   },
  //   {
  //     id: 2,
  //     email: { checksum: 0, size: 0, crc32: 0, compressed: false, value: '' },
  //   },
  // ])

  // await db.update('item', 1, { name: italy })

  // deepEqual(await db.query('item').include('name', { meta: true }).get(), [
  //   {
  //     id: 1,
  //     name: {
  //       checksum: 1734243019465138,
  //       size: 74162,
  //       crc32: 826951513,
  //       compressed: true,
  //       value: italy,
  //     },
  //   },
  //   {
  //     id: 2,
  //     name: { checksum: 0, size: 0, crc32: 0, compressed: false, value: '' },
  //   },
  // ])
})
