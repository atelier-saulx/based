import test from 'ava'
import { encodeSubData, encodeSubDiffData, decode } from '../src'
import tallyData from './tmp.json'

test.serial('encode / decode', async (t) => {
  // Buffer.from(JSON.stringify(data))

  t.deepEqual(
    decode(
      encodeSubData(
        123123123,
        12312323,
        Buffer.from(
          JSON.stringify({
            bla: 'my bla',
          })
        )
      )
    ),
    [1, 123123123, { bla: 'my bla' }, 12312323]
  )

  t.deepEqual(
    decode(
      encodeSubData(
        4232342344,
        324234234,
        Buffer.from(JSON.stringify(tallyData))
      )
    ),
    [1, 4232342344, tallyData, 324234234]
  )

  t.deepEqual(
    decode(
      encodeSubDiffData(
        7218303118662,
        15192283618323,
        11495221250580,
        Buffer.from(
          JSON.stringify({
            name: [0, 'fdgdfgdfggdf'],
            updatedAt: [0, 1656506967463],
          })
        )
      )
    ),
    [
      2,
      7218303118662,
      {
        name: [0, 'fdgdfgdfggdf'],
        updatedAt: [0, 1656506967463],
      },
      [11495221250580, 15192283618323],
    ]
  )

  // sub diff
  // chunks
  // from the client (request sub) (wuth the sub types)
  // ping (type 0 length 1)
})
