// import test from '../shared/test.js'
// import { BasedDb } from '../../src/index.js'
// import { create } from '../../src/client/modify/create/index.js'
// import { Ctx } from '../../src/client/modify/Ctx.js'
// import { drain } from '../../src/client/modify/drain.js'
// import { deepEqual } from '../shared/assert.js'

// test('better create', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//   })

//   await db.start({ clean: true })

//   t.after(() => db.destroy())

//   await db.setSchema({
//     types: {
//       user: {
//         timestamp: 'timestamp',
//         number: 'number',
//         uint8: 'uint8',
//         int8: 'int8',
//         uint16: 'uint16',
//         int16: 'int16',
//         uint32: 'uint32',
//         int32: 'int32',
//         user: {
//           ref: 'user',
//           prop: 'ofUser',
//           $timestamp: 'timestamp',
//           $number: 'number',
//           $uint8: 'uint8',
//           $int8: 'int8',
//           $uint16: 'uint16',
//           $int16: 'int16',
//           $uint32: 'uint32',
//           $int32: 'int32',
//         },
//       },
//     },
//   })

//   db.client.on('info', console.info)
//   db.server.on('info', console.info)

//   const ctx = new Ctx(db.client.schema.hash, new Uint8Array(1000))
//   const lastUser = async (...includes) => {
//     const q = db.query('user')
//     if (includes.length) {
//       q.include(...includes)
//     }
//     const r = await q.get()
//     return r.toObject().at(-1)
//   }

//   const userType = db.client.schemaTypesParsed.user
//   const flushModify = db.client.hooks.flushModify
//   // empty
//   create(ctx, userType, {}, null, flushModify)
//   await drain(ctx, flushModify)
//   deepEqual(await lastUser(), {
//     id: 1,
//     timestamp: 0,
//     number: 0,
//     uint8: 0,
//     int8: 0,
//     uint16: 0,
//     int16: 0,
//     uint32: 0,
//     int32: 0,
//   })
//   // fixed
//   create(
//     ctx,
//     userType,
//     {
//       timestamp: 9,
//       number: 9,
//       uint8: 9,
//       int8: 9,
//       uint16: 9,
//       int16: 9,
//       uint32: 9,
//       int32: 9,
//     },
//     null,
//     flushModify,
//   )
//   await drain(ctx, flushModify)
//   deepEqual(await lastUser(), {
//     id: 2,
//     timestamp: 9,
//     number: 9,
//     uint8: 9,
//     int8: 9,
//     uint16: 9,
//     int16: 9,
//     uint32: 9,
//     int32: 9,
//   })
//   // another
//   create(
//     ctx,
//     userType,
//     {
//       timestamp: 3,
//       number: 3,
//       uint8: 3,
//       int8: 3,
//       uint16: 3,
//       int16: 3,
//       uint32: 3,
//       int32: 3,
//     },
//     null,
//     flushModify,
//   )
//   await drain(ctx, flushModify)
//   deepEqual(await lastUser(), {
//     id: 3,
//     timestamp: 3,
//     number: 3,
//     uint8: 3,
//     int8: 3,
//     uint16: 3,
//     int16: 3,
//     uint32: 3,
//     int32: 3,
//   })
//   // increment
//   create(
//     ctx,
//     userType,
//     {
//       timestamp: { increment: 5 },
//       number: { increment: 5 },
//       uint8: { increment: 5 },
//       int8: { increment: 5 },
//       uint16: { increment: 5 },
//       int16: { increment: 5 },
//       uint32: { increment: 5 },
//       int32: { increment: 5 },
//     },
//     null,
//     flushModify,
//   )
//   await drain(ctx, flushModify)
//   deepEqual(await lastUser(), {
//     id: 4,
//     timestamp: 5,
//     number: 5,
//     uint8: 5,
//     int8: 5,
//     uint16: 5,
//     int16: 5,
//     uint32: 5,
//     int32: 5,
//   })
//   // await
//   const promise = create(
//     ctx,
//     userType,
//     {
//       number: 6,
//     },
//     null,
//     flushModify,
//   )
//   drain(ctx, flushModify)
//   deepEqual(await promise, 5)
//   // ref
//   create(
//     ctx,
//     userType,
//     {
//       user: 1,
//     },
//     null,
//     flushModify,
//   )
//   await drain(ctx, flushModify)
//   deepEqual(await lastUser('user.id'), {
//     id: 6,
//     user: { id: 1 },
//   })
//   // ref by resolved promise tmp
//   create(
//     ctx,
//     userType,
//     {
//       user: promise,
//     },
//     null,
//     flushModify,
//   )
//   await drain(ctx, flushModify)
//   deepEqual(await lastUser('user.id'), {
//     id: 7,
//     user: { id: await promise },
//   })
//   // ref by unresolved promise tmp in the same batch
//   const tmp = create(ctx, userType, {}, null, flushModify)
//   create(ctx, userType, { user: tmp }, null, flushModify)
//   await drain(ctx, flushModify)
//   deepEqual(await lastUser('user.id'), {
//     id: 9,
//     user: { id: await tmp },
//   })
//   // ref by unresolved promise tmp in different batch
//   const tmp2 = create(ctx, userType, {}, null, flushModify)
//   drain(ctx, flushModify)
//   let queued = create(
//     ctx,
//     userType,
//     {
//       user: tmp2,
//     },
//     null,
//     flushModify,
//   )
//   await drain(ctx, flushModify)
//   deepEqual(await lastUser('user.id'), {
//     id: 11,
//     user: { id: await tmp2 },
//   })
//   deepEqual(await queued, 11)
//   // ref by unresolved promise tmp in different batch chain
//   let i = 10
//   while (i--) {
//     queued = create(
//       ctx,
//       userType,
//       {
//         user: queued,
//       },
//       null,
//       flushModify,
//     )
//     drain(ctx, flushModify)
//   }
//   await drain(ctx, flushModify)
//   deepEqual(await lastUser('user.id'), {
//     id: 21,
//     user: { id: 20 },
//   })
//   // ref with edges
//   create(
//     ctx,
//     userType,
//     {
//       user: {
//         id: 1,
//         $uint8: 5,
//       },
//     },
//     null,
//     flushModify,
//   )
//   await drain(ctx, flushModify)
//   deepEqual(await lastUser('user.$uint8'), {
//     id: 22,
//     user: {
//       id: 1,
//       $uint8: 5,
//     },
//   })
// })
