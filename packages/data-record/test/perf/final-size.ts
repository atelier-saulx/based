import v8 from 'v8'
import printResult from './util/print-result.js'
import { compile, createRecord } from '../../src/index.js'

export default function finalSize() {
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
        { name: 'y', type: 'record', def: [{ name: 'a', type: 'uint32_le' }] },
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
  const objV8Serialized = v8.serialize(obj)
  const jsonStr = JSON.stringify(obj)
  const recordBuf = createRecord(compiled, obj)

  printResult('objV8Serialized.length', objV8Serialized.length, 'bytes')
  printResult('jsonStr.length', Buffer.from(jsonStr).length, 'bytes')
  printResult('recordBuf.length', recordBuf.length, 'bytes')
}
