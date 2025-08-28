import test from 'node:test'
import { serialize } from '../src/db-read/schema/serialize.js'
import { deSerializeSchema } from '../src/db-read/schema/deserialize.js'
import { ReaderSchema } from '../dist/db-read/types.js'
import { ENCODER } from '@based/utils'

await test('schema', () => {
  const simple: ReaderSchema = {
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

  const refs: ReaderSchema = {
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

  const textSchema: ReaderSchema = {
    readId: 0,
    props: {
      '1': {
        path: ['fun'],
        typeIndex: 12,
        readBy: 0,
        locales: { '36': 'en', '39': 'fi', '61': 'it' },
      },
    },
    main: { len: 0, props: {} },
    refs: {},
    type: 2,
  }

  const metaSchema: ReaderSchema = {
    readId: 0,
    props: {},
    main: { len: 0, props: {} },
    refs: {
      '1': {
        schema: {
          readId: 0,
          props: {},
          main: { len: 0, props: {} },
          refs: {},
          type: 2,
          edges: {
            readId: 0,
            props: {
              '1': {
                path: ['$edgeName'],
                typeIndex: 11,
                readBy: 0,
                meta: 1,
              },
            },
            main: { len: 0, props: {} },
            refs: {},
            type: 1,
          },
        },
        prop: { path: ['items'], typeIndex: 14, readBy: 0 },
      },
    },
    type: 2,
  }

  const smallMeta: ReaderSchema = {
    readId: 0,
    props: {},
    main: {
      len: 21,
      props: { '0': { path: ['email'], typeIndex: 11, readBy: 0, meta: 1 } },
    },
    refs: {},
    type: 2,
  }

  const enums: ReaderSchema = {
    readId: 0,
    props: {},
    main: {
      len: 1,
      props: {
        '0': {
          path: ['status'],
          typeIndex: 10,
          readBy: 0,
          enum: ['a', 'b', 'c', 'd', 'e', 'f'],
        },
      },
    },
    refs: {},
    type: 2,
    hook: (result) => {
      if (result.private) {
        return {
          id: result.id,
          private: true,
        }
      }
    },
  }

  const agg: ReaderSchema = {
    readId: 0,
    props: {},
    main: { len: 0, props: {} },
    refs: {},
    type: 2,
    aggregate: {
      aggregates: [{ path: ['count'], type: 2, resultPos: 0 }],
      totalResultsSize: 4,
    },
  }

  const schema = agg

  // -----------------------
  const s = serialize(schema)

  const d = Date.now()
  for (let i = 0; i < 1e6; i++) {
    deSerializeSchema(s)
  }
  console.log(Date.now() - d, 'ms')

  console.dir(deSerializeSchema(s), { depth: 10 })
  console.log(
    ENCODER.encode(JSON.stringify(schema)).byteLength,
    'JSON SIZE',
    s.byteLength,
    'PROTO SIZE',
  )
  // deepEqual(schema, deSerializeSchema(s))
})
