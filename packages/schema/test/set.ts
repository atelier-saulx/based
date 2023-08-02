// import test from 'ava'
// import { BasedSchema, setWalker, walk } from '../src/index'
// import { wait } from '@saulx/utils'

// const schema: BasedSchema = {
//   types: {
//     thing: {
//       prefix: 'ti',
//       fields: {
//         something: { type: 'string', format: 'strongPassword' },
//       },
//     },
//     bla: {
//       prefix: 'bl',
//       fields: {
//         referencesToThings: {
//           type: 'references',
//           allowedTypes: ['thing'],
//         },
//         referenceToThing: {
//           type: 'reference',
//           allowedTypes: ['thing'],
//         },
//         exclusiveminmax: {
//           type: 'number',
//           minimum: 3,
//           exclusiveMinimum: true,
//           maximum: 6,
//           exclusiveMaximum: true,
//         },
//         text: {
//           type: 'text',
//           pattern: '[^xz]{1,10}',
//         },
//         timestamp: {
//           type: 'timestamp',
//         },
//         setOfNumbers: {
//           type: 'set',
//           items: {
//             type: 'number',
//           },
//         },
//         x: {
//           type: 'object',
//           properties: {
//             flap: {
//               type: 'boolean',
//             },
//           },
//         },
//         bla: {
//           type: 'set',
//           items: { type: 'string', minLength: 3, maxLength: 6 },
//         },
//       },
//     },
//   },
//   $defs: {},
//   languages: ['en', 'de', 'nl', 'ro', 'za', 'ae'],
//   root: {
//     fields: {},
//   },
//   prefixToTypeMapping: {
//     bl: 'bla',
//     ti: 'thing',
//   },
// }

// console.info('---- doink 15 ------')
// r = await setWalker(schema, {
//   $id: 'bl120',
//   setOfNumbers: [1, 2, 3, 4, 5],
// })

// console.log(r.errors)
// console.dir(
//   r.collected.map((v) => ({ path: v.path, value: v.value })),
//   { depth: 10 }
// )

// console.info('---- doink 16 ------')
// r = await setWalker(schema, {
//   $id: 'bl120',
//   setOfNumbers: { $add: 20 },
// })

// console.log(r.errors)
// console.dir(
//   r.collected.map((v) => ({ path: v.path, value: v.value })),
//   { depth: 10 }
// )

// console.info('---- doink 17 ------')
// r = await setWalker(schema, {
//   $id: 'bl120',
//   setOfNumbers: { $add: [1, 2, 3, 4, 5, 6] },
// })

// console.log(r.errors)
// console.dir(
//   r.collected.map((v) => ({ path: v.path, value: v.value })),
//   { depth: 10 }
// )

// console.info('---- doink 18 ------')
// r = await setWalker(schema, {
//   $id: 'bl120',
//   setOfNumbers: { $remove: [1, 2, 3, 4, 5, 6] },
// })

// console.log(r.errors)
// console.dir(
//   r.collected.map((v) => ({ path: v.path, value: v.value })),
//   { depth: 10 }
// )
