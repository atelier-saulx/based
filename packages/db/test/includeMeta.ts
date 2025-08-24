import { BasedDb, convertToReaderSchema, resultToObject } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { italy } from './shared/examples.js'
import { wait } from '@based/utils'

await test('meta for selva string', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  // t.after(() => t.backup(db))
  t.after(() => db.stop())

  await db.setSchema({
    // add [en,it]
    locales: { en: {}, it: { fallback: 'en' } },
    types: {
      item: {
        props: {
          x: 'uint32',
          y: 'uint32',
          g: ['abraa darba', 'b', 'c'],
          email: { type: 'string', maxBytes: 10 },
          name: 'string',
          derp: {
            props: {
              x: 'string',
            },
          },
          flap: 'text',
          items: {
            items: {
              ref: 'item',
              prop: 'items',
              $name: 'string',
              $x: 'uint8',
              $y: 'string',
              $email: 'string',
            },
          },
        },
      },
    },
  })

  const id1 = await db.create('item', {
    // name: 'This is a longer string',
    flap: { en: 'a2', it: 'b2' },
    // email: 'b@a.com',
    g: 'abraa darba',
    x: 100,
  })

  const id2 = await db.create('item', {
    // name: 'XX',
    flap: { en: 'a', it: 'b' },
    // email: 'a@b.com',
    // x: 100,
    items: [
      {
        id: id1,
        $name: 'DERP!',
        $x: 10,
        $email: 'x@x.com',
      },
    ],
  })

  // const q = await db
  //   .query('item')
  //   .include('items.$name', 'items.$x', 'items.$email', 'items.$y')
  //   .get()

  // q.debug()
  // q.inspect(10, true)

  for (let i = 0; i < 1; i++) {
    for (let i = 0; i < 1e6; i++) {
      db.create('item', {
        x: 100,
        g: 'abraa darba',
        // name: 'Snurp de lerp flap flap derp',
        flap: { it: 'Snurp de lerp flap flap derp' },
      })
    }
    console.log(`set all block ${i} (${i + 1})M items`, await db.drain(), 'ms')
    // await wait(100)
  }

  // 'items.id'
  const q2 = await db
    .query('item')
    .include('flap.en')
    // .locale('it')
    // .include('*', 'items.$name')
    // .include('g', 'x')
    // .include('x', 'name', 'g') // 'name', 'flap'
    .range(0, 1e6)
    .get()

  console.log('exec q', q2.execTime, 'ms', q2.result.byteLength)
  const rDef = convertToReaderSchema(q2.def)
  const d = Date.now()
  const result = resultToObject(rDef, q2.result, q2.result.byteLength - 4, 0)
  console.log('read buf', Date.now() - d, 'ms')

  const y = new TextEncoder()

  const x = JSON.stringify(result)
  const d2 = Date.now()
  const zz = JSON.parse(x)

  console.log(Date.now() - d2, 'ms json parse time')

  console.log(y.encode(x))

  // q2.debug()
  q2.inspect(100)

  console.dir(convertToReaderSchema(q2.def), { depth: 10 })
  console.log(
    'JSON size',
    y.encode(JSON.stringify(convertToReaderSchema(q2.def))),
  )

  // console.log(
  //   'tmp schema',
  //   serializeReaderSchema(convertToReaderSchema(q2.def)),
  // )
  // AGGREGATE
  // LANG (min map)
  // UNDEFINED PROPS (also for text)
  // META
  // START END FOR STRING PROPS
  // cache reader schema on query (and remove on update)

  // console.log(deflateSync(JSON.stringify(convertToReaderSchema(q2.def))))

  // q2.inspect()

  // await (await db.query('item').include('name', 'x').get()).debug()

  // await db.query('item').include('name', 'flap', 'x').get().inspect()

  // const q = await db.query('item').include('name', { meta: true }).get()

  // q.debug()
  // q.inspect(10, true)

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
