// import test from 'node:test'
// import { parseSchema, type Schema } from '../src/schema/schema.js'
// import { schemaToDefs } from '../src/def/index.js'
// import { getAllProps, getPropChain } from '../src/index.js'

// await test('testings', () => {
//   const input: Schema = {
//     types: {
//       role: {
//         name: 'string',
//       },
//       author: {
//         name: 'string',
//         age: 'uint8',
//         articles: {
//           ref: 'article',
//           prop: 'author',
//         },
//       },
//       article: {
//         address: {
//           props: {
//             street: 'string',
//           },
//         },
//         author: {
//           ref: 'author',
//           prop: 'articles',
//           $durt: {
//             ref: 'author',
//           },
//         },
//         collaborators: {
//           items: {
//             ref: 'author',
//             prop: 'collaborations',
//             $role: ['owner', 'reader'],
//             $roles: {
//               items: {
//                 ref: 'role',
//                 // prop: 'ballz',
//                 // $test: 'string',
//               },
//             },
//           },
//         },
//       },
//     },
//   } as const satisfies Schema

//   console.log('-- input')
//   console.dir(input, { depth: null })
//   const schema = parseSchema(input as Schema)
//   console.log('-- strict schema', schema)
//   console.dir(schema, { depth: null })
//   const defs = schemaToDefs(schema)
//   console.log('-- schema defs')
//   console.dir(defs, { depth: 6 })
//   console.log('-- schema path')
//   console.log('collaborators', getPropChain(defs.article, ['collaborators']))
//   console.log(
//     'collaborators.$role',
//     getPropChain(defs.article, ['collaborators', '$role']),
//   )
//   console.log(
//     'collaborators.age',
//     getPropChain(defs.article, ['collaborators', 'age']),
//   )
//   console.log(
//     'collaborators.articles.address',
//     getPropChain(defs.article, ['collaborators', 'articles', 'address']),
//   )

//   console.log('--------------------------------')
//   for (const prop of getAllProps(defs.author)) {
//     console.log('-', prop)
//   }

//   // types.user = { name: 'string' }
// })
