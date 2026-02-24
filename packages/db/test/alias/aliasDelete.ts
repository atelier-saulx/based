// import { notEqual } from 'assert'
// import { BasedDb } from '../../src/index.js'
// import { deepEqual } from '../shared/assert.js'
// import test from '../shared/test.js'
// import { randomUUID } from 'crypto'

// await test('delete', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//   })

//   await db.start({ clean: true })
//   t.after(() => t.backup(db))

//   await db.setSchema({
//     types: {
//       userVerificationToken: {
//         challengeId: { type: 'alias', format: 'UUID' },
//         email: 'string',
//         userId: 'number',
//         firstName: 'string',
//         lastName: 'string',
//         middlePart: 'string',
//         signupSource: 'string',
//         oneTimeCodeHash: 'alias',
//         oneTimeCodeHashConfirmed: 'string',
//         magicLink: 'alias',
//         magiclinkTokenConfirmed: 'string',
//         attemptCount: 'number',
//         maxAttempts: 'number',
//         purpose: ['login', 'registration'],
//         createdAt: {
//           type: 'timestamp',
//           on: 'create',
//         },
//         expiresAt: {
//           type: 'timestamp',
//         },
//       },
//       user: {
//         email: 'string',
//         firstName: 'string',
//         lastName: 'string',
//         middlePart: 'string',
//         handle: 'string',
//         role: 'number',
//         lastLoginAt: 'timestamp',
//         signupSource: 'string',
//       },
//     },
//   })

//   const otc =
//     'a3bca4def31a77b4ab83c06a72c623cd039b4ab88c749fbea831f6aacfe1b7efb63a98682cb3da1f35510a6012c392224ef3a321e5e4577454a7723885a991bb'

//   const workerCount = 10
//   const sessionsPerWorker = 20

//   const unsubs: (() => void)[] = []
//   const waitingDeletes: Promise<any>[] = []

//   const runSession = async (i: number) => {
//     const challengeId = randomUUID()
//     const magicLink = `ml-${i}-${randomUUID()}`
//     const oneTimeCodeHash = `${otc}-${i}`

//     try {
//       const id = await db.create('userVerificationToken', {
//         challengeId,
//         oneTimeCodeHash,
//         magicLink,
//         email: `test${i}@test.com`,
//         purpose: 'login',
//         attemptCount: 0,
//         maxAttempts: 5,
//         expiresAt: Date.now() + 600000,
//       })

//       const unsub1 = db
//         .query('userVerificationToken', { challengeId })
//         .subscribe(() => {})
//       const unsub2 = db
//         .query('userVerificationToken', { oneTimeCodeHash })
//         .subscribe(() => {})
//       unsubs.push(unsub1, unsub2)

//       // Start an aggressive async delete slightly delayed so it executes MIDS-QUERY loop
//       const delPromise = new Promise<void>((resolve) => {
//         setTimeout(() => {
//           db.delete('userVerificationToken', id)
//             .catch(() => {})
//             .finally(resolve)
//         }, Math.random() * 5)
//       })

//       // Immediately bombard the node with reads from multiple worker threads Native C mappings
//       for (let k = 0; k < 50; k++) {
//         const p1 = db.query('userVerificationToken', { magicLink }).get().catch(() => {})
//         const p2 = db.query('userVerificationToken', { challengeId }).get().catch(() => {})
//         const p3 = db.update('userVerificationToken', id, { attemptCount: k }).catch(() => {})
//         waitingDeletes.push(p1, p2, p3)
//       }

//       waitingDeletes.push(delPromise)
//     } catch (err: any) {
//       if (
//         !err.message.includes('not found') &&
//         !err.message.includes('Node does not exist')
//       ) {
//         console.error('Session Error:', err)
//       }
//     }
//   }

//   // Run the chaos
//   const workers = []
//   let sessionIndex = 0

//   for (let w = 0; w < workerCount; w++) {
//     workers.push(
//       (async () => {
//         for (let j = 0; j < sessionsPerWorker; j++) {
//           sessionIndex++
//           runSession(sessionIndex)
//           if (j % 5 === 0) {
//             await new Promise((r) => setTimeout(r, 0))
//           }
//         }
//       })(),
//     )
//   }

//   await Promise.all(workers)

//   await Promise.allSettled(waitingDeletes)
//   unsubs.forEach((u) => u())

//   // Give DB time to flush its background queues before backup validation occurs
//   await new Promise((r) => setTimeout(r, 1000))
// })
// ```
