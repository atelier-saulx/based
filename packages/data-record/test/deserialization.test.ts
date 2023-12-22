import { compile, createRecord, deserialize } from '../src/index.js'

test('deserialization can deconstruct the object it serialized', () => {
  const recordDef = [
    { name: 'a', type: 'uint32_le' },
    { name: 'b', type: 'int32_le' },
    { name: 'c', type: 'int_le', size: 3 },
    { name: 'd', type: 'int_le', size: 5 },
    {
      name: 'nested',
      type: 'record',
      def: [
        { name: 'a', type: 'uint32_le' },
        { name: 'b', type: 'uint32_le' },
      ],
    },
    {
      name: 'x',
      type: 'record',
      def: [
        { name: 'a', type: 'uint32_le' },
        {
          name: 'y',
          type: 'record',
          def: [{ name: 'a', type: 'uint32_le' }],
        },
      ],
    },
  ]

  const compiled = compile(recordDef, { align: false })

  const obj1 = {
    a: 4,
    b: -128,
    c: 10,
    d: 5,
    nested: {
      a: 5,
      b: 5,
    },
    x: {
      a: 5,
      y: {
        a: 5,
      },
    },
  }

  const buf = createRecord(compiled, obj1)
  const obj2 = deserialize(compiled, buf)

  expect(obj1).toEqual(obj2)
})

test('A string can be reconstructed', () => {
  const recordDef = [
    { name: 'a', type: 'uint32_le' },
    { name: 'firstName', type: 'cstring', size: 15 },
  ]
  const obj = {
    a: 4,
    firstName: 'Olli',
  }

  const compiled = compile(recordDef, { align: false })
  const buf = createRecord(compiled, obj)
  const deser = deserialize(compiled, buf)

  expect(deser.a).toBe(4)
  expect(deser.firstName.toString('utf8')).toBe('Olli')
})

test('An integer array can be reconstructed', () => {
  const recordDef = [{ name: 'a', type: 'uint16_be[4]' }]
  const obj = {
    a: [0xbeef, 0xface, 0xcafe, 0xf00d],
  }

  const compiled = compile(recordDef, { align: false })
  expect(compiled.size).toBe(4 * 2)

  const buf = createRecord(compiled, obj)
  expect(buf.toString('hex')).toBe('beeffacecafef00d')

  const deser = deserialize(compiled, buf)
  expect(deser.a).toEqual([0xbeef, 0xface, 0xcafe, 0xf00d])
})
