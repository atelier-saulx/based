import { performance } from 'perf_hooks'
import gc from './util/gc.js'
import {
  allocRecord,
  compile,
  serialize,
  createWriter,
} from '../../src/index.js'

const COUNT = 9999999

export default function unroll() {
  const recordDefEx = [
    { name: 'a', type: 'uint32_be' },
    { name: 'b', type: 'int32_be' },
    { name: 'c', type: 'int_be', size: 3 },
    { name: 'd', type: 'int_be', size: 5 },
  ]

  const obj = {
    a: 0x1234,
    b: 0x1234,
    c: 5,
    d: 6,
  }

  const compiled = compile(recordDefEx)

  function serializer() {
    const buf = allocRecord(compiled)

    for (let i = 0; i < COUNT; i++) {
      const o = JSON.parse(JSON.stringify(obj))
      o.a = (o.a + i) % 1024
      serialize(compiled, buf, o)
    }
  }

  function unrolledSerialize() {
    const buf = allocRecord(compiled)
    const writerA = createWriter(compiled, buf, '.a')
    const writerB = createWriter(compiled, buf, '.b')
    const writerC = createWriter(compiled, buf, '.c')
    const writerD = createWriter(compiled, buf, '.d')

    for (let i = 0; i < COUNT; i++) {
      const o = JSON.parse(JSON.stringify(obj))
      o.a = (o.a + i) % 1024
      writerA(o.a)
      writerB(o.b)
      writerC(o.c)
      writerD(o.d)
    }
  }

  const wrapped = [serializer, unrolledSerialize].map((fn) =>
    performance.timerify(fn)
  )

  for (const test of wrapped) {
    gc()
    // @ts-ignore
    test()
  }
}
