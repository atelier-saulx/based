import test from '../../shared/test.js'
import { deepEqual } from '../../shared/assert.js'
import {
  number,
  timestamp,
  uint8,
  int8,
  uint16,
  int16,
  uint32,
  int32,
  enum_ as enumProp,
  boolean,
} from '../../../src/schema/defs/props/fixed.js'
import {
  string,
  json,
  binary,
  cardinality,
} from '../../../src/schema/defs/props/separate.js'
import {
  references,
  reference,
} from '../../../src/schema/defs/props/references.js'
import { AutoSizedUint8Array } from '../../../src/utils/AutoSizedUint8Array.js'
import { LangCode, Modify } from '../../../src/zigTsExports.js'

await test('Fixed props: write matches pushValue', async (t) => {
  const cases = [
    { Ctor: number, schema: { type: 'number' }, value: 123.456 },
    { Ctor: timestamp, schema: { type: 'timestamp' }, value: Date.now() },
    { Ctor: uint8, schema: { type: 'uint8' }, value: 123 },
    { Ctor: int8, schema: { type: 'int8' }, value: -12 },
    { Ctor: uint16, schema: { type: 'uint16' }, value: 12345 },
    { Ctor: int16, schema: { type: 'int16' }, value: -12345 },
    { Ctor: uint32, schema: { type: 'uint32' }, value: 12345678 },
    { Ctor: int32, schema: { type: 'int32' }, value: -12345678 },
    { Ctor: enumProp, schema: { type: 'enum', enum: ['a', 'b'] }, value: 0 }, // enum index
    { Ctor: boolean, schema: { type: 'boolean' }, value: true },
  ]

  for (const { Ctor, schema, value } of cases) {
    // @ts-ignore
    const prop = new Ctor(schema, ['test'], {})
    const autoBuf = new AutoSizedUint8Array()
    try {
      prop.pushValue(autoBuf, value)
    } catch (e) {
      if (Ctor === enumProp) {
        prop.pushValue(autoBuf, 'a')
      } else {
        throw e
      }
    }

    const pushResult = new Uint8Array(autoBuf.data.subarray(0, autoBuf.length))

    const writeBuf = new Uint8Array(pushResult.length + 10)
    const offset = 2
    // @ts-ignore
    if (Ctor === enumProp) {
      prop.write(writeBuf, 'a', offset)
    } else {
      prop.write(writeBuf, value, offset)
    }

    const writeResult = writeBuf.subarray(offset, offset + pushResult.length)

    deepEqual(writeResult, pushResult, `Mismatch for ${schema.type}`)
  }
})

await test('Separate props: write matches pushValue', async (t) => {
  const cases = [
    {
      Ctor: string,
      schema: { type: 'string' },
      value: 'hello world',
      lang: LangCode.en,
    },
    {
      Ctor: json,
      schema: { type: 'json' },
      value: { foo: 'bar' },
      lang: LangCode.en,
    },
    {
      Ctor: binary,
      schema: { type: 'binary' },
      value: new Uint8Array([1, 2, 3]),
      lang: LangCode.en,
    },
    // Cardinality
    {
      Ctor: cardinality,
      schema: { type: 'cardinality' },
      value: ['a', 'b'],
      lang: LangCode.en,
    },
  ]

  for (const { Ctor, schema, value, lang } of cases) {
    // @ts-ignore
    const prop = new Ctor(schema, ['test'], {})
    const autoBuf = new AutoSizedUint8Array()
    prop.pushValue(autoBuf, value, lang)

    const pushResult = new Uint8Array(autoBuf.data.subarray(0, autoBuf.length))

    const writeBuf = new Uint8Array(pushResult.length + 10)
    const offset = 5
    // @ts-ignore
    prop.write(writeBuf, value, offset, lang)

    const writeResult = writeBuf.subarray(offset, offset + pushResult.length)

    deepEqual(writeResult, pushResult, `Mismatch for ${schema.type}`)
  }
})

await test('References props: write matches pushValue', async (t) => {
  const refsValue = [1000, 2000]

  // @ts-ignore
  const prop = new references({ type: 'references' }, ['test'], {})
  const autoBuf = new AutoSizedUint8Array()

  // Modify.update
  const op = Modify.update

  // @ts-ignore
  prop.pushValue(autoBuf, refsValue, op, LangCode.en)

  const pushResult = new Uint8Array(autoBuf.data.subarray(0, autoBuf.length))

  const writeBuf = new Uint8Array(pushResult.length + 100)
  const offset = 10

  prop.write(writeBuf, refsValue, offset, op, LangCode.en)

  const writeResult = writeBuf.subarray(offset, offset + pushResult.length)

  deepEqual(writeResult, pushResult, 'Mismatch for references')
})
