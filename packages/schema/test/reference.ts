// import test from 'ava'
// import { BasedSchema, setWalker2 } from '../src/index'
// import { resultCollect, errorCollect } from './utils'

// const schema: BasedSchema = {
//   types: {
//     bla: {
//       prefix: 'bl',
//       fields: {
//         ref: {
//           type: 'reference',
//           allowedTypes: ['bl', 'bl1'],
//         },
//         ref2: {
//           type: 'references',
//           allowedTypes: ['bl'],
//         },
//         arr: {
//           type: 'array',
//           title: '',
//         },
//       },
//     },
//   },
//   $defs: {},
//   languages: ['en'],
//   root: {
//     fields: {},
//   },
//   prefixToTypeMapping: {
//     bl: 'bla',
//   },
// }

// test('reference', async (t) => {
//   const e1 = await setWalker2(schema, {
//     $id: 'bl1',
//     ref: ['1', '2'],
//   })
//   const e2 = await setWalker2(schema, {
//     $id: 'bl1',
//     ref: 1,
//   })

//   const res = await setWalker2(schema, {
//     $id: 'bl1',
//     ref: 'asdasdasdasdasd',
//   })

//   t.assert(errorCollect([e1, e2]).length > 0)
//   t.deepEqual(resultCollect([res]), [
//     { path: ['ref'], value: 'asdasdasdasdasd' },
//   ])
// })

// test('multiple references', async (t) => {
//   // const e = await (
//   //   setWalker2(
//   //     schema,
//   //     {
//   //       $id: 'bl1',
//   //       ref2: 0.5,
//   //     },
//   //
//   //   )
//   // )
//   // const e = await (
//   //   setWalker2(
//   //     schema,
//   //     {
//   //       $id: 'bl1',
//   //       ref2: 1,
//   //     },
//   //
//   //   )
//   // )
//   // these should throw, array of refs doesnt
//   //??? todo?
//   const e = await setWalker2(schema, {
//     $id: 'bl1',
//     ref2: [1, 1, 1, 1, 1, 1, 1],
//   })
//   const res1 = await setWalker2(schema, {
//     $id: 'bl1',
//     ref2: ['1', '2', '3'],
//   })

//   t.assert(errorCollect([e]).length === 1)
//   t.deepEqual(resultCollect([res1]), [
//     { path: ['ref2'], value: { $value: ['1', '2', '3'] } },
//   ])
// })

// test('value of references', async (t) => {
//   const e = await setWalker2(schema, {
//     $id: 'bl1',
//     ref: { $value: ['1', '2'] },
//   })
//   const e1 = await setWalker2(schema, {
//     $id: 'bl1',
//     ref: { $value: 1 },
//   })

//   const res1 = await setWalker2(schema, {
//     $id: 'bl1',
//     ref: { $value: 'asdasdasdasdasd' },
//   })

//   //error here?
//   t.assert(errorCollect([e, e1]).length === 2)
//   t.deepEqual(resultCollect([res1]), [
//     { path: ['ref'], value: { $value: 'asdasdasdasdasd' } },
//   ])
// })

// test('default of references', async (t) => {
//   const e2 = await setWalker2(schema, {
//     $id: 'bl1',
//     ref: { $default: ['1', '2'] },
//   })
//   const e1 = await setWalker2(schema, {
//     $id: 'bl1',
//     ref: { $default: 1 },
//   })

//   // await setWalker2(
//   //   schema,
//   //   {
//   //     $id: 'bl1',
//   //     ref: { $default: 'asdasdasdasdasd' },
//   //   },
//   //
//   // )
//   // console.log('----:XX', resultCollect)
//   // //error here?
//   // t.deepEqual(resultCollect, [
//   //   { path: ['ref'], value: { $default: 'asdasdasdasdasd' } },
//   // ])
//   t.assert(errorCollect([e2, e1]).length === 2)
// })

// test.only('allowedTypes', async (t) => {
//   const e1 = await setWalker2(schema, {
//     $id: 'bl1',
//     ref: ['1', '2'],
//   })
//   const e2 = await setWalker2(schema, {
//     $id: 'bs1',
//     ref: 1,
//   })
//   const res1 = await setWalker2(schema, {
//     $id: 'bl1',
//     ref: 'blastuff',
//   })

//   t.assert(errorCollect([e2, e1]).length === 2)
//   t.deepEqual(resultCollect([res1]), [{ path: ['ref'], value: 'bl1stuff' }])
//   // is this wrong or am i wrong
// })
