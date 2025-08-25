// import { BasedDb } from '../src/index.js'
// import test from './shared/test.js'

// await test('slice string / text', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//   })
//   await db.start({ clean: true })
//   t.after(() => t.backup(db))

//   await db.setSchema({
//     locales: {
//       en: {},
//       it: {},
//     },
//     types: {
//       item: {
//         props: {
//           name: 'string',
//           // body: 'text',
//           // email: { maxBytes: 20, type: 'string' }, // fix main prop
//           // items: {
//           //   items: {
//           //     ref: 'item',
//           //     prop: 'items',
//           //     $edgeName: 'string',
//           //   },
//           // },
//         },
//       },
//     },
//   })

//   const id1 = await db.create('item', {
//     // first uncompressed then compressed!
//     // use something long e.g. italy
//     name: 'mr flaperinus is here for you and me!',
//   })

//   await db
//     .query('item')
//     .include('name', { start: 0, end: 5 })
//     .get()
//     .inspect(10, true)
// })
