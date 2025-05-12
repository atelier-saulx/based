import test from './shared/test.js'

await test('upsert', async (t) => {
  const buf = new Uint8Array(10)
  buf[2] = 1

  const y = buf.subarray(1)

  const x = new Uint8Array(y)

  buf[2] = 2

  console.log(x[1])

  console.log(x.buffer, buf.buffer)
})
