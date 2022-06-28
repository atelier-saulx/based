import test from 'ava'
import { encodeSubData, decodeSubData } from '../src'
test.serial('encode / decode', async (t) => {
  let x = encodeSubData(123123123, 12312323, {
    bla: 'my bla',
  })

  const view = new Uint8Array(x)

  console.info(view)

  decodeSubData(view)

  t.pass('yes')
})
