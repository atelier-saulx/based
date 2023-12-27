import { compile, createRecord, deserialize } from '../src/index.js'
import test from 'ava'

test.serial('int8[1]', (t) => {
  const def = [{ name: 'a', type: 'int8[1]' }]
  const compiled = compile(def, { align: false })
  const buf = createRecord(compiled, {
    a: [1],
  })

  t.is(buf.length, 1)
  t.is(buf.toString('hex'), '01')
})

test.serial('serializing int8[2]', (t) => {
  const def = [{ name: 'a', type: 'int8[2]' }]
  const compiled = compile(def, { align: false })
  const buf = createRecord(compiled, {
    a: [1, 2],
  })

  t.is(buf.length, 2)
  t.is(buf.toString('hex'), '0102')
})

test.serial('serializing cstring[2]', (t) => {
  const def = [{ name: 'a', type: 'cstring[2]', size: 10 }]
  const compiled = compile(def, { align: false })
  const buf = createRecord(compiled, {
    a: ['hello', 'world'],
  })

  t.is(buf.length, 2 * 10)
  t.is(buf.toString('utf8'), 'hello\0\0\0\0\0world\0\0\0\0\0')
})

test.serial('serializing record[2]', (t) => {
  const def = [
    {
      name: 'a',
      type: 'record[2]',
      def: [{ name: 'value', type: 'uint32_be' }],
    },
  ]
  const compiled = compile(def, { align: false })
  const buf = createRecord(compiled, {
    a: [{ value: 1337 }, { value: 42069 }],
  })

  t.is(buf.length, 2 * 4)
  t.is(buf.toString('hex'), '000005390000a455')
})

test.serial('serializing record[i].record', (t) => {
  const def = [
    {
      name: 'a',
      type: 'record[2]',
      def: [
        {
          name: 'nest',
          type: 'record',
          def: [{ name: 'value', type: 'uint32_be' }],
        },
      ],
    },
  ]
  const compiled = compile(def, { align: false })
  const buf = createRecord(compiled, {
    a: [{ nest: { value: 1337 } }, { nest: { value: 42069 } }],
  })

  t.is(buf.length, 2 * 4)
  t.is(buf.toString('hex'), '000005390000a455')
})

test.serial('serializing record.record[i]', (t) => {
  const def = [
    {
      name: 'a',
      type: 'record',
      def: [
        {
          name: 'nest',
          type: 'record[2]',
          def: [{ name: 'value', type: 'uint32_be' }],
        },
      ],
    },
  ]
  const compiled = compile(def, { align: false })
  const buf = createRecord(compiled, {
    a: { nest: [{ value: 1337 }, { value: 42069 }] },
  })

  t.is(buf.length, 2 * 4)
  t.is(buf.toString('hex'), '000005390000a455')
})

test.serial('serializing record.record[i].record', (t) => {
  const def = [
    {
      name: 'a',
      type: 'record',
      def: [
        {
          name: 'nesta',
          type: 'record[2]',
          def: [
            {
              name: 'nestb',
              type: 'record',
              def: [{ name: 'value', type: 'uint32_be' }],
            },
          ],
        },
      ],
    },
  ]
  const compiled = compile(def, { align: false })
  const buf = createRecord(compiled, {
    a: {
      nesta: [{ nestb: { value: 1337 } }, { nestb: { value: 42069 } }],
    },
  })

  t.is(buf.length, 2 * 4)
  t.is(buf.toString('hex'), '000005390000a455')
})

test.serial('serializing record.record[i].record[j]', (t) => {
  const def = [
    {
      name: 'a',
      type: 'record',
      def: [
        {
          name: 'nesta',
          type: 'record[3]',
          def: [
            {
              name: 'nestb',
              type: 'record[2]',
              def: [{ name: 'value', type: 'uint32_be' }],
            },
          ],
        },
      ],
    },
  ]
  const compiled = compile(def, { align: false })
  const buf = createRecord(compiled, {
    a: {
      nesta: [
        {
          nestb: [{ value: 1337 }, { value: 42069 }],
        },
        {
          nestb: [{ value: 1337 }, { value: 42069 }],
        },
        {
          nestb: [{ value: 1337 }, { value: 42069 }],
        },
      ],
    },
  })

  t.is(buf.length, 3 * 2 * 4)
  t.is(buf.toString('hex'), '000005390000a455000005390000a455000005390000a455')
})

test.serial('int8[1] #2', (t) => {
  const def = [{ name: 'a', type: 'int8[1]' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('01', 'hex')
  const obj = deserialize(compiled, buf)
  t.deepEqual(obj, { a: [1] })
})

test.serial('int8[3]', (t) => {
  const def = [{ name: 'a', type: 'int8[3]' }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('010101', 'hex')
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, { a: [1, 1, 1] })
})

test.serial('deserializing cstring[2]', (t) => {
  const def = [{ name: 'a', type: 'cstring[2]', size: 10 }]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('hello\0\0\0\0\0world\0\0\0\0\0', 'utf8')
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, {
    a: ['hello', 'world'],
  })
})

test.serial('deserializing record[2]', (t) => {
  const def = [
    {
      name: 'a',
      type: 'record[2]',
      def: [{ name: 'value', type: 'uint32_be' }],
    },
  ]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('000005390000a455', 'hex')
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, {
    a: [{ value: 1337 }, { value: 42069 }],
  })
})

test.serial('deserializing record[i].record', (t) => {
  const def = [
    {
      name: 'a',
      type: 'record[2]',
      def: [
        {
          name: 'nest',
          type: 'record',
          def: [{ name: 'value', type: 'uint32_be' }],
        },
      ],
    },
  ]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('000005390000a455', 'hex')
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, {
    a: [{ nest: { value: 1337 } }, { nest: { value: 42069 } }],
  })
})

test.serial('deserializing record.record[i]', (t) => {
  const def = [
    {
      name: 'a',
      type: 'record',
      def: [
        {
          name: 'nest',
          type: 'record[2]',
          def: [{ name: 'value', type: 'uint32_be' }],
        },
      ],
    },
  ]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('000005390000a455', 'hex')
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, {
    a: { nest: [{ value: 1337 }, { value: 42069 }] },
  })
})

test.serial('deserializing record.record[i].record', (t) => {
  const def = [
    {
      name: 'a',
      type: 'record',
      def: [
        {
          name: 'nesta',
          type: 'record[2]',
          def: [
            {
              name: 'nestb',
              type: 'record',
              def: [{ name: 'value', type: 'uint32_be' }],
            },
          ],
        },
      ],
    },
  ]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from('000005390000a455', 'hex')
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, {
    a: {
      nesta: [{ nestb: { value: 1337 } }, { nestb: { value: 42069 } }],
    },
  })
})

test.serial('deserializing record.record[i].record[j]', (t) => {
  const def = [
    {
      name: 'a',
      type: 'record',
      def: [
        {
          name: 'nesta',
          type: 'record[3]',
          def: [
            {
              name: 'nestb',
              type: 'record[2]',
              def: [{ name: 'value', type: 'uint32_be' }],
            },
          ],
        },
      ],
    },
  ]
  const compiled = compile(def, { align: false })
  const buf = Buffer.from(
    '000005390000a455000005390000a455000005390000a455',
    'hex'
  )
  const obj = deserialize(compiled, buf)

  t.deepEqual(obj, {
    a: {
      nesta: [
        {
          nestb: [{ value: 1337 }, { value: 42069 }],
        },
        {
          nestb: [{ value: 1337 }, { value: 42069 }],
        },
        {
          nestb: [{ value: 1337 }, { value: 42069 }],
        },
      ],
    },
  })
})
