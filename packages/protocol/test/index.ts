import test from 'ava'
import { encodeSubData, decodeSubData } from '../src'
test.serial('encode / decode', async (t) => {
  const x = await encodeSubData(123123123, 12312323, {
    bla: 'my bla',
  })

  console.log(x)

  // const view = new Uint8Array(x)

  decodeSubData(x)

  t.pass('yes')
})
