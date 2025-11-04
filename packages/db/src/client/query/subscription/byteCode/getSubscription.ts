// import { includeOp } from '../../types.js'
// import { readUint16 } from '@based/utils'

// const readUint8 = (buffer: Uint8Array, offset: number): number => {
//   return buffer[offset]
// }

// type Type = {
//   typeId: number
//   id?: number
//   alias?: string
//   propPath: number[]
// }

// function collect(
//   bytecode: Uint8Array,
//   offset: number,
//   types: Type[],
//   currentPath: number[],
// ): number {
//   while (offset < bytecode.length) {
//     const op = readUint8(bytecode, offset)
//     offset += 1

//     switch (op) {
//       case includeOp.REFERENCES:
//       case includeOp.REFERENCE: {
//         const size = readUint16(bytecode, offset)
//         offset += 2
//         const filterSize = readUint16(bytecode, offset)
//         offset += 2
//         const sortSize = readUint16(bytecode, offset)
//         offset += 2
//         offset += 4 // offset
//         offset += 4 // limit

//         offset += filterSize
//         offset += sortSize

//         const typeId = readUint16(bytecode, offset)
//         offset += 2
//         const prop = readUint8(bytecode, offset)
//         offset += 1

//         const newPath = [...currentPath, prop]

//         references.push({
//           typeId,
//           propPath: newPath,
//         })

//         // The rest of the block is the included fields for the reference
//         const endOfMeta = offset
//         const endOfBlock = endOfMeta + size - (15 + filterSize + sortSize)
//         const nestedBytecode = new Uint8Array(
//           bytecode.buffer,
//           bytecode.byteOffset + offset,
//           endOfBlock - offset,
//         )

//         if (nestedBytecode.length > 0) {
//           collect(nestedBytecode, 0, references, newPath)
//         }

//         offset = endOfBlock
//         break
//       }
//       case includeOp.DEFAULT: {
//         offset += 2 // prop and typeIndex
//         const optsLen = readUint8(bytecode, offset)
//         offset += 1
//         offset += optsLen
//         break
//       }
//       case includeOp.META: {
//         offset += 3 // prop, typeIndex, code
//         break
//       }
//       case includeOp.PARTIAL: {
//         offset += 2 // prop and typeIndex
//         const len = readUint16(bytecode, offset)
//         offset += 2
//         offset += len
//         break
//       }
//       case includeOp.EDGE: {
//         const edgeSize = readUint16(bytecode, offset)
//         offset += 2
//         offset += edgeSize
//         break
//       }
//       default:
//         // This is a safeguard. If we encounter an unknown op, we stop parsing.
//         // A more robust implementation would require the full spec from the Zig code.
//         return offset
//     }
//   }

//   return offset
// }

// export default function collectReferences(bytecode: Uint8Array): Reference[] {
//   const references: Reference[] = []
//   collect(bytecode, 0, references, [])
//   return references
// }
