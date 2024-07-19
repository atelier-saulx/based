import { Query } from './query.js'

export const createSingleRefBuffer = (query: Query) => {
  const arr = []
  // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1]   ([0][len][len][offset][offset][len][len]) [1][2]

  for (const ref of query.refIncludes) {
    // only do main to start...
    let refsingleBuffer: Buffer
    let size = 6

    // add extra ref normal fields now
    console.info({ ref })

    if (ref.mainLen) {
      if (ref.mainLen !== ref.schema.mainLen) {
        size += 3

        // MAIN SELECT FIELDS SIZE
        size += ref.main.length * 4

        // MAIN SIZE
        size += 4
      } else {
        // LATEr (just 0)
      }

      // -------- START WRITING
      refsingleBuffer = Buffer.allocUnsafe(size)

      // SIZE [0,1]
      refsingleBuffer.writeUint16LE(size - 6)

      if (ref.mainLen !== ref.schema.mainLen) {
        // TYPE [2,3]
        refsingleBuffer[2] = ref.schema.prefix[0]
        refsingleBuffer[3] = ref.schema.prefix[1]

        // REF [4,5]
        refsingleBuffer.writeUint16LE(ref.ref.start, 4)

        // MAIN FIELD [6]
        refsingleBuffer[6] = 0

        // MAIN SELECTIVE FIELDS [7,8]
        refsingleBuffer.writeUint16LE(ref.main.length * 4, 7)

        // MAIN LEN [9,10,11,12] // can be 16...
        refsingleBuffer.writeUint32LE(ref.mainLen, 9)

        // MAIN SELECT [13 ....]
        let i = 9 + 4
        for (let x of ref.main) {
          refsingleBuffer.writeUint16LE(x.start, i)
          refsingleBuffer.writeUint16LE(x.len, i + 2)
          i += 4
        }

        console.log('GET', {
          refsingleBuffer: new Uint8Array(refsingleBuffer),
        })

        arr.push(refsingleBuffer)
      } else {
        // later
      }

      // add fields
    }
  }
  return Buffer.concat(arr)
}
