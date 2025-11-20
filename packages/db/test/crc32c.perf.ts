import { crc32c } from '@based/hash'
import test from './shared/test.js'
import { crc32 as nativeCrc32 } from '../src/index.js'

const ENCODER = new TextEncoder()

await test('Hash generation PERF', async (t) => {
  const val = ENCODER.encode(`oid${1e6}`)
  console.time('1E6 CRC32c TS')
  for (let i = 0; i < 1e6; i++) {
    crc32c(val)
  }
  console.timeEnd(`1E6 CRC32c TS`)

  console.time('1E6 CRC32c Native')
  for (let i = 0; i < 1e6; i++) {
    nativeCrc32(val)
  }
  console.timeEnd(`1E6 CRC32c Native`)
})
