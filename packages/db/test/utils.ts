import { equals, base64encode } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { encodeBase64 } from '@saulx/utils'
import { italy } from './shared/examples.js'

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

await test('base64encode', async (t) => {
  const a = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])
  const ourRes = base64encode(a)
  const nodeRes = Buffer.from(a).toString('base64')

  deepEqual(ourRes, nodeRes)
})

await test('base64encode perf', async (t) => {
  const arr = new TextEncoder().encode(italy)
  const buf = Buffer.from(arr)
  const u8 = Uint8Array.from(arr)
  const amount = 100

  let d = performance.now()
  for (let i = 0; i < amount; i++) {
    buf.toString('base64')
  }
  console.log('node', performance.now() - d, 'ms')

  d = performance.now()
  for (let i = 0; i < amount; i++) {
    encodeBase64(u8)
  }
  console.log('js', performance.now() - d, 'ms')

  d = performance.now()
  for (let i = 0; i < amount; i++) {
    base64encode(u8)
  }
  console.log('selva', performance.now() - d, 'ms')
})
