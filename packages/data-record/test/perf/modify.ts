import v8 from 'v8'
import { performance } from 'perf_hooks'
import gc from './util/gc.js'
import {
  compile,
  createRecord,
  readValue,
  writeValue,
  createReader,
  createWriter,
} from '../../src/index.js'

const COUNT = 99999

export default function modify() {
  const recordDefEx = [
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

  const obj = {
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

  const compiled = compile(recordDefEx)

  function nativeObjectTest() {
    // @ts-ignore
    let x = 0

    for (let i = 0; i < COUNT; i++) {
      x = obj.x.y.a
      obj.x.y.a = i
    }
  }

  function nativeV8SerializerTest() {
    let ser = v8.serialize(obj)

    // @ts-ignore
    let x = 0

    for (let i = 0; i < COUNT; i++) {
      const o = v8.deserialize(ser)
      x = o.x.y.a
      o.x.y.a = i
      ser = v8.serialize(o)
    }
  }

  function jsonTest() {
    let str = JSON.stringify(obj)

    // @ts-ignore
    let x = 0

    for (let i = 0; i < COUNT; i++) {
      const o = JSON.parse(str)
      x = o.x.y.a
      o.x.y.a = i
      str = JSON.stringify(o)
    }
  }

  function dataRecordTestSlow() {
    const buf = createRecord(compiled, obj)

    // @ts-ignore
    let x = 0

    for (let i = 0; i < COUNT; i++) {
      x = readValue(compiled, buf, '.x.y.a')
      writeValue(compiled, buf, '.x.y.a', i)
    }
  }

  function dataRecordTestFast() {
    const buf = createRecord(compiled, obj)
    const reader = createReader(compiled, buf, '.x.y.a')
    const writer = createWriter(compiled, buf, '.x.y.a')

    // @ts-ignore
    let x = 0

    for (let i = 0; i < COUNT; i++) {
      x = reader()
      writer(i)
    }
  }

  const wrapped = [
    nativeObjectTest,
    nativeV8SerializerTest,
    jsonTest,
    dataRecordTestSlow,
    dataRecordTestFast,
  ].map((fn) => performance.timerify(fn))

  for (const test of wrapped) {
    gc()
    // @ts-ignore
    test()
  }
}
