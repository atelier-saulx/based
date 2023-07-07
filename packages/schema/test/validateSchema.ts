import test from 'ava'
import { validateSchema } from '../src/index'

test.serial('throw on invalid schema', async (t) => {
  const err = t.throws(() => {
    validateSchema({
      types: {
        bla: {
          prefix: 'fix',
          fields: {},
        },
      },
    })
  })

  t.is(
    err.message,
    'Incorrect prefix "fix" for type "bla" has to be a string of 2 alphanumerical characters e.g. "Az", "ab", "cc", "10"'
  )
})

// test.serial('parse and validate schema', async (t) => {
//   // this will be the internally stored one

//   const newSchema = parseSchema({
//     types: {
//       bla: {
//         prefix: 'bl',
//         fields: {
//           form: {
//             title: 'A registration form',
//             description: 'A simple form example.',
//             type: 'object',
//             required: ['firstName', 'lastName'],
//             properties: {
//               firstName: {
//                 type: 'string',
//                 title: 'First name',
//                 default: 'Chuck',
//               },
//               lastName: {
//                 type: 'string',
//                 title: 'Last name',
//               },
//               age: {
//                 type: 'integer',
//                 title: 'Age',
//               },
//               bio: {
//                 type: 'string',
//                 title: 'Bio',
//               },
//               password: {
//                 type: 'string',
//                 title: 'Password',
//                 minLength: 3,
//               },
//               telephone: {
//                 type: 'string',
//                 title: 'Telephone',
//                 minLength: 10,
//               },
//             },
//           },
//           examples: [
//             {
//               lastName: 'Norris',
//               age: 75,
//               bio: 'Roundhouse kicking asses since 1940',
//               password: 'noneed',
//             },
//           ],
//         },
//       },
//     },
//   })

//   // validateType(type, payload)

//   // validatePath(type, path, payload)

//   // validateTypeById(id, payload)

//   // validatePathById(id, path, payload)

//   t.true(true)
// })
