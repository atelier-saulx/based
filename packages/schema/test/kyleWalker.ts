import test from 'ava'
import { BasedSchema, setWalker2, walk } from '../src/index'

test.only('klyle set walker', async (t) => {
  const schema: BasedSchema = {
    types: {
      bla: {
        prefix: 'bl',
        fields: {
          aNumber: {
            type: 'number',
            maximum: 10,
          },
          aInteger: {
            type: 'integer',
            maximum: 10,
            exclusiveMaximum: true,
          },
          date: {
            type: 'timestamp',
          },
          aString: {
            type: 'string',
            // maxLength: 10,
            // minLength: 2,
            // format: 'email',
          },
          aText: {
            type: 'text',
          },
          aRef: {
            type: 'reference',
          },
          references: {
            type: 'references',
          },
        },
      },
    },
    $defs: {},
    languages: ['en', 'de'],
    root: {
      fields: {},
    },
    prefixToTypeMapping: {
      bl: 'bla',
    },
  }

  // const x = await setWalker2(schema, {
  //   $id: 'bl1',
  //   aInteger: { $increment: 9 },
  //   aNumber: {
  //     $decrement: 5,
  //     $default: 5,
  //   },
  //   date: { $default: '01/02/2022', $increment: 5e3 },
  // })

  // console.info('------------', x)

  // const x2 = await setWalker2(schema, {
  //   $id: 'bl1',
  //   aNumber: {
  //     $default: 5,
  //   },
  //   date: 'now',
  // })

  // console.info('------------', x2)

  const x2 = await setWalker2(schema, {
    $id: 'bl1',
    // aString: '123',
    aString: { $value: '1234' },
    // aString: { $default: 'blablablabla' },
    // $language: 'de',
    // aText: 'blabla',

    // aText: {
    //   en: 'ax',
    //   de: 'axa',
    // },
  })

  // const ref = await setWalker2(schema, {
  //   $id: 'bl1',
  //   // aRef: { $value: '123123' },
  //   references: ['11111111111', '2222222222', '3333333'],
  // })

  console.info('------------', x2.target.collected, x2.errors)

  t.true(true)
})
