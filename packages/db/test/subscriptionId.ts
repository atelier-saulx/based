// import { BasedDb } from '../src/index.js'
// import { deepEqual } from './shared/assert.js'
// import test from './shared/test.js'
// import { wait } from '@saulx/utils'

// await test('subscription  many', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//   })

//   await db.start({ clean: true })

//   t.after(() => {
//     return t.backup(db)
//   })

//   await db.setSchema({
//     types: {
//       payment: {
//         props: {
//           status: ['a', 'b', 'c', 'd', 'e'],
//         },
//       },
//     },
//   })

//   const amount = 1e5

//   // worker +
//   let ids = []
//   for (let i = 1; i <= amount; i++) {
//     ids.push(db.create('payment', { status: 'a' }).tmpId)
//   }
//   await db.isModified()

//   let d = performance.now()
//   let cnt = 0
//   for (let i = 0; i < ids.length; i++) {
//     const id = ids[i]
//     db.query('payment', id)
//       .include('status')
//       .subscribe(() => {
//         cnt++
//       })
//   }

//   let x = setInterval(() => {
//     if (cnt === amount) {
//       console.log(performance.now() - d, 'got all events')
//       clearInterval(x)
//     }
//   }, 1)
//   await wait(1e3)

//   const handleSize = 1e4
//   let lastId = 1
//   d = performance.now()
//   const y = setInterval(async () => {
//     if (lastId < amount) {
//       for (let i = 0; i < handleSize; i++) {
//         if (lastId + i < amount) {
//           db.update('payment', i + lastId, { status: 'b' })
//         }
//       }
//       await db.isModified()
//       lastId = handleSize + lastId
//     } else {
//       console.log('DONE!', cnt, performance.now() - d)
//       clearInterval(y)
//     }
//   }, 1e3)

//   await wait(5e3)
// })

// await test('subscription enum shared', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//   })

//   await db.start({ clean: true })

//   t.after(() => {
//     return t.backup(db)
//   })

//   await db.setSchema({
//     types: {
//       payment: {
//         props: {
//           status: ['a', 'b', 'c', 'd', 'e'],
//         },
//       },
//     },
//   })

//   const amount = 1e5

//   // worker +
//   let ids = []
//   for (let i = 1; i <= amount; i++) {
//     ids.push(db.create('payment', { status: 'a' }).tmpId)
//   }
//   await db.isModified()
//   const xxxx = await db
//     .query('payment')
//     .filter('status', '=', ['a', 'b'])
//     .sort('status')
//     .range(0, 1e6)
//     .get()

//   let d = performance.now()

//   let cnt = 0

//   let totalTime = 0
//   let totalQExecuted = 0
//   let x = setInterval(async () => {
//     const blurfy = await db
//       .query('payment')
//       .include('status')
//       .filter('status', '=', ['a', 'b'])
//       .sort('status')
//       .range(0, 1e6)
//       .get()

//     let p = performance.now()
//     cnt = blurfy.length
//     totalTime += blurfy.execTime + (performance.now() - p)
//     totalQExecuted++
//   }, 300)

//   await wait(300)

//   const handleSize = 1e5
//   let lastId = 1
//   d = performance.now()

//   const y = setInterval(async () => {
//     if (lastId < amount) {
//       for (let i = 0; i < handleSize; i++) {
//         if (lastId + i < amount) {
//           db.update('payment', i + lastId, { status: 'b' })
//         }
//       }
//       await db.isModified()
//       lastId = handleSize + lastId
//     }

//     if (lastId - handleSize > 0) {
//       for (let i = 0; i < handleSize; i++) {
//         if (lastId + i - handleSize > 0) {
//           db.update('payment', lastId + i - handleSize, { status: 'c' })
//         }
//       }
//     }

//     if (cnt === 0) {
//       console.log(
//         'DONE!',
//         cnt,
//         performance.now() - d,
//         totalTime,
//         'ms',
//         '#',
//         totalQExecuted,
//       )
//       clearInterval(y)
//       clearInterval(x)
//     }
//   }, 1e3)

//   await wait(5e3)
// })
