// import { writeString } from './props/string.js'

// const create = (payload) => {
//   const name = payload.name ?? ''
//   const email = payload.email ?? ''
//   const age = payload.age ?? 0
//   const address_street = payload.address?.street ?? ''
//   if (name !== undefined) writeString(ctx, def, val, 0)
//   if (email !== undefined) writeString(ctx, def, email, 0)
// }

// const schema = [
//   ['name'],
//   ['email'],
//   ['age'],
//   ['address', 'street'],
//   ['address', 'postalCode'],
// ]

// // schema things that are used in modify
// const a = { a: 'b' }
// // console.log(Object.entries(a).map(() => ))

// // 1,2,3,4,5,6

// // 2

// // 1,2 // low: 1
// // 2,3 // del 1, low: 2
// // 3,4 // del 2, low: 3
// // 4,5 // del 3, low: 4
// // 5,6 // del 4
// // 6,1 // del 5
// // 1,2 // del 6
// // 2,3 // del 1

// // ON INSERT
// //   DEL newId - maxAmount (negative deletes from end)

// // amount = 10
// // maxAmount = 3

// // newId = 2

// // 2 - 3

// // DEL (maxId + newId - maxAmount) % maxId

// const db: any = {}
// db.create('sequence', {
//   name: 'Countdown 1',
//   edition: db.upsert('edition', { name: 'LITHUANIA' })
// })

// db.upsert('edition', {
//   name: 'LITHUANIA',
//   sequences: [
//     db.create('sequence', {
//       name: 'Countdown 1',
//       edition: db.upsert('edition', { name: 'LITHUANIA' }),
//     }),
//   ],
// })
