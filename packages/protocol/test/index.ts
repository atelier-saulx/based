import test from 'ava'
import { encodeSubData, decodeSubData } from '../src'
import tallyData from './tmp.json'

test.serial('encode / decode', async (t) => {
  t.deepEqual(
    decodeSubData(
      await encodeSubData(123123123, 12312323, {
        bla: 'my bla',
      })
    ),
    [1, 123123123, { bla: 'my bla' }, 12312323]
  )

  t.deepEqual(
    decodeSubData(await encodeSubData(4232342344, 324234234, tallyData)),
    [1, 4232342344, tallyData, 324234234]
  )
})
