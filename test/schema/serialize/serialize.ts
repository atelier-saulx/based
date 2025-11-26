import { deSerialize, parse, serialize, type SchemaOut } from '@based/sdk'
import { test } from '../../shared/index.js'
import eurovisionSchema from './schema/based.schema.js'
import { ok } from 'assert'

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

test('serialize and deserialize basic schema', async () => {
  const basicSchema: SchemaOut = {
    hash: 0,
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
            type: 'reference',
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
            type: 'references',
            items: {
              type: 'reference',
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

test('serialize and deserialize complex (Eurovision) schema', async () => {
  const serialized = serialize(eurovisionSchema)
  const deserialized = deSerialize(serialized)

  ok(
    deepEqual(eurovisionSchema, deserialized),
    'Eurovision schema did not match after roundtrip',
  )

  // console.log(
  //   serialized.byteLength,
  //   deflateSync(JSON.stringify(eurovisionSchema)).byteLength,
  // )
})

test('serialize with readOnly option strips validation and defaults', async () => {
  const schema: SchemaOut = {
    hash: 0,
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

  const expected: SchemaOut = {
    hash: 0,
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

// optimize this with an extra map
// keep serialized schema in MEM
test('big schema', async () => {
  const makeALot = (n: number) => {
    const props: any = {}
    for (let i = 0; i < n; i++) {
      props[`f${i}`] = { type: 'int32' }
    }
    return props
  }

  const basicSchema: SchemaOut = {
    hash: 0,
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

test('Simple shared prop', async () => {
  const basicSchema: SchemaOut = parse({
    types: {
      article: {
        props: {
          body: { type: 'string' },
        },
      },
      italy: {
        props: {
          body: { type: 'string' },
        },
      },
    },
  }).schema

  const serialized = serialize(basicSchema)
  const deserialized = deSerialize(serialized)
  ok(deepEqual(basicSchema, deserialized), 'Mismatch')
})

test('empty schema', async () => {
  const serialized = serialize({})
  const deserialized = deSerialize(serialized)
  ok(deepEqual({}, deserialized), 'Mismatch')
})

test('schema with 1 unit8array', async () => {
  const x = { x: new Uint8Array([1, 2, 3]) }
  const serialized = serialize(x)
  const deserialized = deSerialize(serialized)
  ok(deepEqual(x, deserialized), 'Mismatch')
})

test('schema with 1 unit8array array', async () => {
  const x = {
    x: [{ x: new Uint8Array([1, 2, 3]) }, { x: new Uint8Array([1, 2, 3]) }],
  }
  const serialized = serialize(x)
  const deserialized = deSerialize(serialized)
  ok(deepEqual(x, deserialized), 'Mismatch')
})

test('empty uint8Array', async () => {
  const deserialized = deSerialize(new Uint8Array())
  ok(deepEqual({}, deserialized), 'Mismatch')
})

test('schema with hash', async () => {
  const serialized = serialize({ hash: 14986952164472 })
  const deserialized = deSerialize(serialized)
  ok(deepEqual({ hash: 14986952164472 }, deserialized), 'Mismatch')
})

// make something like serialize for payloads in the server
test('serialize random object', async () => {
  const obj = { bla: [1, 23, 2, 12, { x: 1 }] }
  const serialized = serialize(obj)
  const deserialized = deSerialize(serialized)
  ok(deepEqual(obj, deserialized), 'Mismatch')
})
