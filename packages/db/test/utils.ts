import { equals } from '../src/index.js'
import test from './shared/test.js'

await test('equals', async (t) => {
  const arr = new Array(1000).fill(0)
  const arr2 = new Array(1000).fill(0)

  const buf1 = Buffer.from(arr)
  const buf2 = Buffer.from(arr2)
  const amount = 1e6
  let d = performance.now()
  let cnt = 0
  for (let i = 0; i < amount; i++) {
    if (buf1.equals(buf2)) {
      cnt++
    }
  }

  console.log(performance.now() - d, 'ms', cnt)

  const a = new Uint8Array(arr)
  const b = new Uint8Array(arr2)

  d = performance.now()
  cnt = 0

  // global.gc()

  for (let i = 0; i < amount; i++) {
    if (equals(a, b)) {
      cnt++
    }
  }

  console.log(equals(a, b))

  console.log(performance.now() - d, 'ms', cnt)
})
