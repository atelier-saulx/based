import v8 from 'v8'
import { performance } from 'perf_hooks'
import fs from 'fs'
import { join as pathJoin } from 'path'
import gc from './util/gc.js'
import {
  compile,
  allocRecord,
  serialize,
  generateRecordDef,
} from '../../src/index.js'

const dataFiles: [number, string][] = [
  [99999, './data/simple.json'],
  [99999, './data/nesting.json'],
  [99999, './data/mega-flat.json'],
  [9999, './data/numbers.json'],
  [9999, './data/arrays.json'],
]

export default function serialization() {
  const objs = dataFiles.map(([_, path]) =>
    JSON.parse(fs.readFileSync(pathJoin(__dirname, path)).toString())
  )
  const recordDefs = objs.map((o) => generateRecordDef(o))

  function nativeV8SerializerTest(i: number, n: number) {
    const obj = objs[i]
    const o = JSON.parse(JSON.stringify(obj))

    for (let i = 0; i < n; i++) {
      v8.deserialize(v8.serialize(o))
    }
  }

  function jsonTest(i: number, n: number) {
    const obj = objs[i]
    const o = JSON.parse(JSON.stringify(obj))

    for (let i = 0; i < n; i++) {
      JSON.parse(JSON.stringify(o))
    }
  }

  function dataRecordSerializeTest(i: number, n: number) {
    const obj = objs[i]
    const compiled = compile(recordDefs[i])
    const o = JSON.parse(JSON.stringify(obj))

    for (let i = 0; i < n; i++) {
      const buf = allocRecord(compiled)

      // deserialize(compiled, serialize(compiled, buf, o));
      serialize(compiled, buf, o)
    }
  }

  const wrapped = [
    nativeV8SerializerTest,
    jsonTest,
    dataRecordSerializeTest,
  ].map((fn) => performance.timerify(fn))

  for (let i = 0; i < objs.length; i++) {
    const [n, dataFile] = dataFiles[i]

    console.log(dataFile)
    for (const test of wrapped) {
      gc()
      // @ts-ignore
      test(i, n)
    }
    console.log('')
  }
}
