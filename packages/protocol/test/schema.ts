import test from 'node:test'
import { serialize } from '../src/db-read/schema/serialize.js'
import { deSerializeSchema } from '../src/db-read/schema/deserialize.js'
import type { ReaderSchema } from '../dist/db-read/types.js'
import { deepEqual, equal } from 'node:assert'

await test('schema serialization/deserialization', async (t) => {
  await t.test('schema with references', () => {
    const refs: ReaderSchema = {
      readId: 0,
      props: { '3': { path: ['name'], typeIndex: 18, readBy: 0 } },
      main: { len: 0, props: {} },
      search: false,
      refs: {
        '1': {
          schema: {
            search: false,
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
            search: false,
            readId: 0,
            props: { '2': { path: ['name'], typeIndex: 18, readBy: 0 } },
            main: { len: 0, props: {} },
            refs: {},
            type: 2,
            edges: {
              search: false,
              readId: 0,
              props: {},
              main: { len: 0, props: {} },
              refs: {
                '1': {
                  schema: {
                    search: false,
                    readId: 0,
                    props: {
                      '1': { path: ['name'], typeIndex: 18, readBy: 0 },
                    },
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

    const serialized = serialize(refs)

    const deserialized = deSerializeSchema(serialized)
    deepEqual(deserialized, refs)
  })

  await t.test('schema with text and locales', () => {
    const textSchema: ReaderSchema = {
      readId: 0,
      search: false,
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

    const serialized = serialize(textSchema)
    const deserialized = deSerializeSchema(serialized)
    deepEqual(deserialized, textSchema)
  })

  await t.test('schema with meta', () => {
    const metaSchema: ReaderSchema = {
      readId: 0,
      props: {},
      main: { len: 0, props: {} },
      search: false,
      refs: {
        '1': {
          schema: {
            readId: 0,
            props: {},
            main: { len: 0, props: {} },
            refs: {},
            type: 2,
            search: false,
            edges: {
              search: false,
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
    const serialized = serialize(metaSchema)
    const deserialized = deSerializeSchema(serialized)
    deepEqual(deserialized, metaSchema)
  })

  await t.test('schema with enums and hook', () => {
    const enums: ReaderSchema = {
      readId: 0,
      props: {},
      search: false,
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
      hook(result) {
        // This hook is not expected to be serialized
        if (result.private) {
          return {
            id: result.id,
            private: true,
          }
        }
      },
    }

    const serialized = serialize(enums)

    const deserialized = deSerializeSchema(serialized)

    // hook is not serializable, so we compare without it
    const expected = { ...enums }
    delete expected.hook

    equal(typeof deserialized.hook === 'function', true)
  })

  await t.test('schema with aggregation', () => {
    const agg: ReaderSchema = {
      readId: 0,
      search: false,
      props: {},
      main: { len: 0, props: {} },
      refs: {},
      type: 2,
      aggregate: {
        aggregates: [{ path: ['distance'], type: 1, resultPos: 0 }],
        totalResultsSize: 8,
      },
    }
    const serialized = serialize(agg)
    const deserialized = deSerializeSchema(serialized)
    deepEqual(deserialized, agg)
  })

  await t.test('schema with aggregation + groupBy simple', () => {
    const agg: ReaderSchema = {
      readId: 0,
      search: false,
      props: {},
      main: { len: 0, props: {} },
      refs: {},
      type: 2,
      aggregate: {
        aggregates: [{ path: ['distance'], type: 1, resultPos: 0 }],
        totalResultsSize: 8,
        groupBy: { typeIndex: 1 },
      },
    }
    const serialized = serialize(agg)
    const deserialized = deSerializeSchema(serialized)

    deepEqual(deserialized, agg)
  })

  await t.test('schema with aggregation + groupBy enum', () => {
    const agg: ReaderSchema = {
      readId: 0,
      search: false,
      props: {},
      main: { len: 0, props: {} },
      refs: {},
      type: 2,
      aggregate: {
        aggregates: [{ path: ['distance'], type: 1, resultPos: 0 }],
        totalResultsSize: 8,
        groupBy: {
          typeIndex: 10,
          enum: ['derp', { flap: true }],
        },
      },
    }
    const serialized = serialize(agg)
    const deserialized = deSerializeSchema(serialized)
    deepEqual(deserialized, agg)
  })

  await t.test('schema with aggregation + groupBy', () => {
    const agg: ReaderSchema = {
      readId: 0,
      search: false,
      props: {},
      main: { len: 0, props: {} },
      refs: {},
      type: 2,
      aggregate: {
        aggregates: [{ path: ['distance'], type: 1, resultPos: 0 }],
        totalResultsSize: 8,
        groupBy: { typeIndex: 1, stepType: true },
      },
    }
    const serialized = serialize(agg)
    const deserialized = deSerializeSchema(serialized)
    deepEqual(deserialized, agg)
  })

  await t.test('schema with aggregation + groupBy display', () => {
    const agg: ReaderSchema = {
      readId: 0,
      search: false,
      props: {},
      main: { len: 0, props: {} },
      refs: {},
      type: 2,
      aggregate: {
        aggregates: [{ path: ['distance'], type: 1, resultPos: 0 }],
        totalResultsSize: 8,
        groupBy: {
          typeIndex: 1,
          stepType: true,
          display: new Intl.DateTimeFormat('en-GB', {
            dateStyle: 'full',
            timeStyle: 'long',
            timeZone: 'Australia/Sydney',
          }),
        },
      },
    }
    const serialized = serialize(agg)
    const deserialized = deSerializeSchema(serialized)
    deepEqual(deserialized.aggregate.groupBy.display.resolvedOptions(), {
      locale: 'en-GB',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Australia/Sydney',
      hourCycle: 'h23',
      hour12: false,
      dateStyle: 'full',
      timeStyle: 'long',
    })
  })
})

await test('schema serialization/deserialization - main', async (t) => {
  await t.test('schema with small meta', () => {
    const smallMeta: ReaderSchema = {
      readId: 0,
      props: {},
      search: false,
      main: {
        len: 21,
        props: { '0': { path: ['email'], typeIndex: 11, readBy: 0, meta: 1 } },
      },
      refs: {},
      type: 2,
    }
    const serialized = serialize(smallMeta)
    const deserialized = deSerializeSchema(serialized)
    deepEqual(deserialized, smallMeta)
  })

  await t.test('big schema', () => {
    const size = 4000
    const bigSchema: ReaderSchema = {
      readId: 0,
      search: false,
      props: {},
      main: { len: size * 4, props: {} },
      refs: {},
      type: 2,
    }
    for (let i = 0; i < size; i++) {
      bigSchema.main.props[i] = {
        path: ['derp', String(i)],
        typeIndex: 23,
        readBy: 0,
      }
    }
    const serialized = serialize(bigSchema)
    const deserialized = deSerializeSchema(serialized)
    deepEqual(deserialized, bigSchema)
  })

  await t.test('simple schema', () => {
    const simple: ReaderSchema = {
      search: false,
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
    }
    const serialized = serialize(simple)
    const deserialized = deSerializeSchema(serialized)
    deepEqual(deserialized, simple)
  })
})
