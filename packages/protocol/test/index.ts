import test from 'ava'
import { encodeSubData, decode } from '../src'
import tallyData from './tmp.json'

test.serial('encode / decode', async (t) => {
  t.deepEqual(
    decode(
      await encodeSubData(123123123, 12312323, {
        bla: 'my bla',
      })
    ),
    [1, 123123123, { bla: 'my bla' }, 12312323]
  )

  t.deepEqual(decode(await encodeSubData(4232342344, 324234234, tallyData)), [
    1,
    4232342344,
    tallyData,
    324234234,
  ])

  // sub diff
  // chunks
  // from the client (request sub) (wuth the sub types)
  // ping (type 0 length 1)
})
