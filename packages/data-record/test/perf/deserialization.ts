import { performance } from 'perf_hooks'
import fs from 'fs'
import gc from './util/gc.js'
import {
  compile,
  deserialize,
  generateRecordDef,
  createRecord,
} from '../../src/index.js'

import { dirname, join as pathJoin } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const dataFiles: [number, string][] = [
  [99999, './data/simple.json'],
  [99999, './data/nesting.json'],
  [99999, './data/mega-flat.json'],
  [9999, './data/numbers.json'],
  [9999, './data/arrays.json'],
]

export default function deserialization() {
  const data = dataFiles.map(([, path]) =>
    fs.readFileSync(pathJoin(__dirname, path)).toString()
  )
  const objs = data.map((text) => JSON.parse(text))

  const recordDefs = objs.map((obj) => generateRecordDef(obj))

  const compiled = objs.map((obj, i) => compile(recordDefs[i], obj))
  const bufs = objs.map((obj, i) => createRecord(compiled[i], obj))

  function jsonTest(i: number, n: number) {
    const text = data[i]

    for (let i = 0; i < n; i++) {
      JSON.parse(text)
    }
  }

  function dataRecordSerializeTest(i: number, n: number) {
    const comp = compiled[i]
    const buf = bufs[i]

    for (let i = 0; i < n; i++) {
      deserialize(comp, buf)
    }
  }

  const wrapped = [jsonTest, dataRecordSerializeTest].map((fn) =>
    performance.timerify(fn)
  )

  for (let i = 0; i < data.length; i++) {
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
