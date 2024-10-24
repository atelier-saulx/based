// import { join as pathJoin } from 'node:path'
// import { readdir } from 'node:fs/promises'
// import { BasedDb } from '../src/index.js'
// import test from './shared/test.js'
// import { deepEqual, equal } from './shared/assert.js'

// await test('save simple range', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//     splitDump: true,
//   })

//   await db.start({ clean: true })

//   t.after(() => {
//     return db.destroy()
//   })

//   db.putSchema({
//     types: {
//       user: {
//         props: {
//           name: { type: 'string' },
//           email: { type: 'string' },
//           age: { type: 'uint32' },
//         },
//       },
//     },
//   })

//   db.create('user', {
//     age: 1337,
//     name: 'mr disaster',
//     email: 'disaster@disaster.co.uk',
//   })
//   db.create('user', {
//     age: 1453,
//     name: 'mr flop',
//     email: 'flop@disaster.co.uk',
//   })

//   db.drain()

//   let err: number

//   err = db.native.saveCommon(pathJoin(db.fileSystemPath, 'common.sdb'))
//   equal(err, 0)
//   err = db.native.saveRange(
//     pathJoin(db.fileSystemPath, 'user_0.sdb'),
//     db.schema.types.user.id,
//     1,
//     1,
//   )
//   equal(err, 0)
//   err = db.native.saveRange(
//     pathJoin(db.fileSystemPath, 'user_1.sdb'),
//     db.schema.types.user.id,
//     2,
//     2,
//   )
//   equal(err, 0)
//   const ls = await readdir(db.fileSystemPath)
//   equal(ls.includes('common.sdb'), true)
//   equal(ls.includes('user_0.sdb'), true)
//   equal(ls.includes('user_1.sdb'), true)

//   await db.stop(true)

//   const newDb = new BasedDb({
//     path: t.tmp,
//     splitDump: true,
//   })

//   await newDb.start()

//   t.after(() => {
//     return newDb.destroy()
//   })

//   deepEqual(
//     newDb
//       .query('user')
//       .include('name')
//       .sort('name')
//       .range(0, 2)
//       .get()
//       .toObject(),
//     [
//       {
//         id: 1,
//         name: 'mr disaster',
//       },
//       {
//         id: 2,
//         name: 'mr flop',
//       },
//     ],
//   )
// })
