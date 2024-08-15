// export const getIdFast = (id: Uint8Array, buff: Buffer) => {
//   let i = 0
//   while (i < buff.length) {
//     const amountIndex0 = i + 3
//     const len0 = buff.readUint16LE(i + 1)
//     if (buff.readUint16LE(amountIndex0) == 0) {
//       i += len0
//     } else if (id[0] == buff[i]) {
//       const end0 = len0 + i
//       i += 6
//       while (i < end0) {
//         const amountIndex1 = i + 3
//         const len1 = buff.readUint16LE(i + 1)
//         if (buff.readUint16LE(amountIndex1) == 0) {
//           i += len1
//         } else if (id[1] == buff[i]) {
//           const end1 = len1 + i
//           i += 6
//           while (i < end1) {
//             const amountIndex2 = i + 3
//             const len2 = buff.readUint16LE(i + 1)
//             if (buff.readUint16LE(amountIndex2) == 0) {
//               i += len2
//             } else if (id[2] == buff[i]) {
//               const end2 = len2 + i
//               i += 6
//               while (i < end2) {
//                 const amountIndex3 = i + 3
//                 const len3 = buff.readUint16LE(i + 1)
//                 if (buff.readUint16LE(amountIndex3) == 0) {
//                   i += len3
//                 } else if (id[3] == buff[i]) {
//                   buff.writeUint16LE(
//                     buff.readUint16LE(amountIndex0) - 1,
//                     amountIndex0,
//                   )
//                   buff.writeUint16LE(
//                     buff.readUint16LE(amountIndex1) - 1,
//                     amountIndex1,
//                   )
//                   buff.writeUint16LE(
//                     buff.readUint16LE(amountIndex2) - 1,
//                     amountIndex2,
//                   )
//                   buff.writeUint16LE(
//                     buff.readUint16LE(amountIndex3) - 1,
//                     amountIndex3,
//                   )
//                   return true
//                 } else {
//                   i += len3
//                 }
//               }
//             } else {
//               i += len2
//             }
//           }
//         } else {
//           i += len1
//         }
//       }
//     } else {
//       i += len0
//     }
//   }
//   return false
// }

// buffer to tree
// const buftime2 = (t: Flap, offset: number, max: number) => {
//   let i = offset
//   while (i < max) {
//     const key = buff[i]
//     const total = buff.readUint16LE(i + 3)
//     const len = buff.readUint16LE(i + 1)
//     const size = 0
//     const n = {
//       size,
//       branchSize: len / 5,
//       total,
//     }
//     t[key] = n
//     buftime2(n, offset + 5, len + offset)
//     i += len
//   }
// }

type TreeNode = any

export const createTree = (ids: number[]) => {
  var bufferSize = 0
  var total = 0
  const make = (x: Uint8Array, t: TreeNode, nr: number): TreeNode => {
    if (!t[x[nr]]) {
      t.size++
      total++
      bufferSize += 6
      t[x[nr]] =
        nr === 3
          ? {
              parent: t,
              size: 0,
              total: 1,
              nr,
              branchSize: 1,
            }
          : {
              parent: t,
              size: 0,
              total: 1,
              nr,
              branchSize: 1,
            }
      let p = t
      while (p) {
        p.branchSize++
        p = p.parent
      }
    } else {
      t[x[nr]].total++
    }
    if (nr < 3) {
      // add cnt that you can bring down
      make(x, t[x[nr]], nr + 1)
    }
    return t
  }

  const t: TreeNode = { size: 0, branchSize: 0, total: 0 }

  for (const y of ids) {
    const buf = Buffer.allocUnsafe(4)
    buf.writeUint32LE(y)
    make(buf, t, 0)
  }

  const buff = Buffer.allocUnsafe(bufferSize)
  let offset = 0
  const buftime = (t: TreeNode) => {
    for (const key in t) {
      if (
        key !== 'parent' &&
        key !== 'size' &&
        key !== 'branchSize' &&
        key !== 'total' &&
        key !== 'nr'
      ) {
        const s = t[key]
        buff[offset] = Number(key)
        buff.writeUint16LE(s.branchSize * 6, 1 + offset)
        buff.writeUint16LE(s.total, 3 + offset)
        buff[offset + 5] = s.nr

        offset += 6
        buftime(t[key])
      }
    }
  }

  buftime(t)

  return buff
}
