import test from 'node:test'
import { ok } from 'node:assert'
import { serialize, deSerialize, StrictSchema, parse } from '../src/index.js'
import eurovisionSchema from './schema/based.schema.js'
import { deflateSync } from 'node:zlib'

// deepEqual that ignore functions (ai generated)
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b
  }
  if (a.constructor !== b.constructor) return false
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }
  if (typeof a === 'object') {
    const keysA = Object.keys(a).filter((key) => typeof a[key] !== 'function')
    const keysB = new Set(
      Object.keys(b).filter((key) => typeof b[key] !== 'function'),
    )
    if (keysA.length !== keysB.size) return false
    for (const key of keysA) {
      if (!keysB.has(key) || !deepEqual(a[key], b[key])) {
        return false
      }
    }
    return true
  }
  return false
}

test('serialize and deserialize basic schema', () => {
  const basicSchema: StrictSchema = {
    locales: {
      en: { required: true },
      nl: {},
    },
    types: {
      thing: {
        props: {
          name: { type: 'string', default: 'thingy' },
          nested: {
            type: 'object',
            props: {
              field: { type: 'number' },
            },
          },
          ref: {
            ref: 'other',
            prop: 'backref',
          },
          validationFn: {
            type: 'string',
            validation: (v) => v.startsWith('valid'),
          },
        },
      },
      other: {
        props: {
          backref: {
            readOnly: true,
            items: {
              ref: 'thing',
              prop: 'ref',
            },
          },
        },
      },
    },
  }

  const serialized = serialize(basicSchema)
  const deserialized = deSerialize(serialized)

  ok(deepEqual(basicSchema, deserialized), 'Basic schema did not match')
})

test('serialize and deserialize complex (Eurovision) schema', () => {
  const serialized = serialize(eurovisionSchema)
  const deserialized = deSerialize(serialized)

  ok(
    deepEqual(eurovisionSchema, deserialized),
    'Eurovision schema did not match after roundtrip',
  )
})

test('serialize with readOnly option strips validation and defaults', () => {
  const schema: StrictSchema = {
    types: {
      thing: {
        props: {
          name: { type: 'string', default: 'thingy' },
          age: { type: 'number', validation: (v) => v > 18 },
        },
      },
    },
  }

  const serialized = serialize(schema, { readOnly: true })
  const deserialized = deSerialize(serialized)

  const expected: StrictSchema = {
    types: {
      thing: {
        props: {
          name: { type: 'string' }, // default removed
          age: { type: 'number' }, // validation removed
        },
      },
    },
  }
  ok(
    deepEqual(deserialized, expected),
    'readOnly option did not strip fields correctly',
  )
})

test('big schema', () => {
  const makeALot = (n: number) => {
    const props: any = {}
    for (let i = 0; i < n; i++) {
      props[`f${i}`] = { type: 'int32' }
    }
    return props
  }

  const basicSchema: StrictSchema = {
    locales: {
      en: { required: true },
      nl: {},
    },
    types: {
      thing: {
        props: {
          ...makeALot(16000),
        },
      },
    },
  }

  const serialized = serialize(basicSchema)
  const deserialized = deSerialize(serialized)

  ok(deepEqual(basicSchema, deserialized), 'Big schema did not match')
})

test('Simple + enum', () => {
  const makeALot = (n: number) => {
    const props: any = {}
    for (let i = 0; i < n; i++) {
      props[`f${i}`] = { type: 'int32' }
    }
    return props
  }

  const basicSchema: StrictSchema = parse({
    locales: {
      en: { required: true },
      nl: {},
    },
    types: {
      article: {
        props: {
          type: ['opinion', 'politcis', 'gossip'],
          code: { type: 'string', maxBytes: 2 },
          age: { type: 'uint32' },
          name: { type: 'string' },
          body: { type: 'string' }, // big compressed string...
          stuff: 'binary',
          derp: 'binary',
        },
      },
      italy: {
        props: {
          body: { type: 'string' }, // big compressed string...
        },
      },
    },
  }).schema

  const serialized = serialize(basicSchema)
  const deserialized = deSerialize(serialized)

  console.dir({ basicSchema, deserialized }, { depth: 10 })

  ok(deepEqual(basicSchema, deserialized), 'Mismatch')
})
