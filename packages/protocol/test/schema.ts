import test from 'node:test'
import { serialize } from '../src/db-read/schema/serialize.js'
import { deSerializeSchema } from '../src/db-read/schema/deserialize.js'
import { ReaderSchema } from '../dist/db-read/types.js'
import { ENCODER } from '@based/utils'

await test('schema', () => {
  const x: ReaderSchema = {
    readId: 0,
    props: { '1': { path: ['name'], typeIndex: 11, readBy: 0 } },
    main: {
      len: 2,
      props: {
        '0': { path: ['age'], typeIndex: 6, readBy: 0 },
        '1': { path: ['defined', 'age'], typeIndex: 9, readBy: 0 },
      },
    },
    refs: {},
    type: 2,
    // hook: [Function: read]
  }

  const schema: ReaderSchema = {
    readId: 0,
    props: { '3': { path: ['name'], typeIndex: 18, readBy: 0 } },
    main: { len: 0, props: {} },
    refs: {
      '1': {
        schema: {
          readId: 0,
          props: { '2': { path: ['name'], typeIndex: 18, readBy: 0 } },
          main: { len: 0, props: {} },
          refs: {},
          type: 2,
        },
        prop: { path: ['round'], typeIndex: 13, readBy: 0 },
      },
      '2': {
        schema: {
          readId: 0,
          props: { '2': { path: ['name'], typeIndex: 18, readBy: 0 } },
          main: { len: 0, props: {} },
          refs: {},
          type: 2,
          edges: {
            readId: 0,
            props: {},
            main: { len: 0, props: {} },
            refs: {
              '1': {
                schema: {
                  readId: 0,
                  props: { '1': { path: ['name'], typeIndex: 18, readBy: 0 } },
                  main: { len: 0, props: {} },
                  refs: {},
                  type: 2,
                },
                prop: { path: ['$sequence'], typeIndex: 13, readBy: 0 },
              },
            },
            type: 1,
          },
        },
        prop: { path: ['scenarios'], typeIndex: 14, readBy: 0 },
      },
    },
    type: 2,
  }

  console.log('schema')
  const s = serialize(schema)

  const d = Date.now()
  // for (let i = 0; i < 1e6; i++) {
  //   deSerializeSchema(s)
  // }
  console.log(Date.now() - d, 'ms')

  console.dir(deSerializeSchema(s), { depth: 10 })
  console.log(s)
  console.log(
    ENCODER.encode(JSON.stringify(schema)).byteLength,
    'JSON SIZE',
    s.byteLength,
    'PROTO SIZE',
  )
  // deepEqual(schema, deSerializeSchema(s))
})
