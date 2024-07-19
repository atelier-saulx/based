import { Query } from './query.js'

// type __r

// offset

// { includeTree, mainLen, mainIncludes } // maybe better mainInclude

// type SingleRef = { [start: string]: [number]
// mainLen: number = 0
// mainIncludes: { [start: string]: [number, FieldDef] }

// ;[
// 1, 0, 0, 0,
// 255,
// id: 1, 0, 0, 0,
// field 0,
// country code: 97, 97, 0,  // give info of start
// userId: 62, 2, 0, 0,
// select ref 0, 254, 3, 0, [start 3]
// field 0,
// user.age 66, 0, 0, 0
// field 1,
// 6, 0, 77, 114, 32, 53, 55, 51,
// ]

// }

export const createSingleRefBuffer = (query: Query) => {
  const arr = []
  // [len][len][type][type][start][start] [255][len][len][type][type][start][start][1] ([0][len][len][offset][offset][len][len]) [1][2]

  for (const ref of query.refIncludes) {
    // only do main to start...
    let refsingleBuffer: Buffer
    let size = 6
    let i = 0
    // add extra ref normal fields now
    // console.info({ ref })

    size += ref.fields?.length ?? 0

    if (ref.mainLen) {
      size += 1

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

      // TYPE [2,3]
      refsingleBuffer[2] = ref.schema.prefix[0]
      refsingleBuffer[3] = ref.schema.prefix[1]

      i += 6

      if (ref.mainLen !== ref.schema.mainLen) {
        // REF [4,5]
        refsingleBuffer.writeUint16LE(ref.ref.start, 4)

        // MAIN FIELD [6]
        refsingleBuffer[6] = 0

        // MAIN SELECTIVE FIELDS [7,8]
        refsingleBuffer.writeUint16LE(ref.main.length * 4, 7)

        // MAIN LEN [9,10,11,12] // can be 16...
        refsingleBuffer.writeUint32LE(ref.mainLen, 9)

        // MAIN SELECT [13 ....]
        i = 9 + 4
        for (let x of ref.main) {
          refsingleBuffer.writeUint16LE(x.start, i)
          refsingleBuffer.writeUint16LE(x.len, i + 2)
          i += 4
        }
      } else {
        // later
      }

      i++
      refsingleBuffer[i] = 0

      // add fields
    }

    for (const f of ref.fields) {
      refsingleBuffer[i] = f.field
      console.info(f)
      i++
    }

    refsingleBuffer.writeUint16LE(size - 6)

    console.log('GET', {
      refsingleBuffer: new Uint8Array(refsingleBuffer),
    })

    return refsingleBuffer
    // arr.push(refsingleBuffer)
  }

  // console.log('flap', arr)

  // return Buffer.concat(arr)
}
