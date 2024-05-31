import { FieldDef, SchemaFieldTree, SchemaTypeDef } from './schemaTypeDef.js'

function BasedNodeBase(schema: SchemaTypeDef) {
  this.__schema__ = schema
}
Object.defineProperty(BasedNodeBase.prototype, '__buffer__', {
  writable: true,
  enumerable: false,
})
Object.defineProperty(BasedNodeBase.prototype, '__offset__', {
  writable: true,
  enumerable: false,
})
Object.defineProperty(BasedNodeBase.prototype, '__schema__', {
  enumerable: false,
  writable: true,
})

export class BasedNode extends Object {
  [key: string]: any
}

const readSeperateFieldFromBuffer = (
  // make 1 for multuple as well
  requestedField: FieldDef,
  buffer: Buffer,
  type: SchemaTypeDef,
  i: number,
) => {
  while (i < buffer.byteLength) {
    const index = buffer[i]
    if (index === 255) {
      return // cant find...
    }
    i += 1
    if (index === 0) {
      if (requestedField.field === 0) {
        console.log('lullz')
      }
      // for (const f in this.type.fields) {
      //   const field = this.type.fields[f]
      //   if (!field.seperate) {
      //     if (this.includeFields) {
      //       if (!this.includeFields.includes(f)) {
      //         continue
      //       }
      //     }
      //     if (field.type === 'integer' || field.type === 'reference') {
      //       setByPath(
      //         lastTarget,
      //         field.path,
      //         result.readUint32LE(i + field.start),
      //       )
      //     } else if (field.type === 'number') {
      //       setByPath(lastTarget, field.path, result.readFloatLE(i + field.start))
      //     }
      //   }
      // }
      i += type.mainLen
    } else {
      const size = buffer.readUInt16LE(i)
      i += 2
      if (requestedField.field === index) {
        if (requestedField.type === 'string') {
          return buffer.toString('utf8', i, size + i)
        } else if (requestedField.type === 'references') {
          const x = new Array(size / 4)
          for (let j = i; j < size / 4; j += 4) {
            x[j / 4] = buffer.readUint32LE(j)
          }
          return x
        }
      }
      i += size
    }
  }
}

export const createBasedNodeClass = (
  schema: SchemaTypeDef,
): typeof BasedNode => {
  const Node = function (buffer: Buffer, offset: number) {
    this.__buffer__ = buffer
    this.__offset__ = offset
  }
  Node.prototype = new BasedNodeBase(schema)

  Object.defineProperty(Node.prototype, 'id', {
    enumerable: true,
    set() {
      // flap
    },
    get() {
      return this.__buffer__.readUint32LE(this.__offset__)
    },
  })

  for (const field in schema.fields) {
    const fieldDef = schema.fields[field]
    const { type, path } = fieldDef

    if (path.length > 1) {
      // flap make
    } else if (type === 'string') {
      Object.defineProperty(Node.prototype, field, {
        enumerable: true,
        set() {
          // flap
        },
        get() {
          return readSeperateFieldFromBuffer(
            fieldDef,
            this.__buffer__,
            schema,
            this.__offset__ + 4,
          )
        },
      })
    } else if (type === 'number') {
      Object.defineProperty(Node.prototype, field, {
        enumerable: true,
        // writable: true,
        set() {
          // flap
        },
        get() {
          return readSeperateFieldFromBuffer(
            fieldDef,
            this.__buffer__,
            schema,
            this.__offset__ + 4,
          )
        },
      })
    } else if (type === 'reference') {
      Object.defineProperty(Node.prototype, field, {
        enumerable: true,
        set() {
          // flap
        },
        get() {
          // return instance of ref
          return { id: 'some REF return instanceOf' }
        },
      })
    }
  }

  // @ts-ignore
  return Node as typeof BasedNode
}

// // --------- OPTIMIZATION NEEDED ------------------
// let lastTarget
// let i = 4
// while (i < result.byteLength) {
//   // read
//   const index = result[i]
//   i++
//   // read from tree
//   if (index === 255) {
//     lastTarget = {
//       // last id is what we want...
//       id: result.readUint32LE(i),
//     }
//     arr.push(lastTarget)
//     i += 4
//   } else if (index === 0) {
//     for (const f in this.type.fields) {
//       const field = this.type.fields[f]
//       if (!field.seperate) {
//         if (this.includeFields) {
//           if (!this.includeFields.includes(f)) {
//             continue
//           }
//         }
//         if (field.type === 'integer' || field.type === 'reference') {
//           setByPath(
//             lastTarget,
//             field.path,
//             result.readUint32LE(i + field.start),
//           )
//         } else if (field.type === 'number') {
//           setByPath(
//             lastTarget,
//             field.path,
//             result.readFloatLE(i + field.start),
//           )
//         }
//       }
//     }
//     i += this.type.mainLen
//   } else {
//     const size = result.readUInt16LE(i)
//     i += 2
//     // MAKE THIS FAST
//     for (const f in this.type.fields) {
//       const field = this.type.fields[f]
//       if (field.seperate) {
//         if (field.field === index) {
//           if (field.type === 'string') {
//             setByPath(
//               lastTarget,
//               field.path,
//               result.toString('utf8', i, size + i),
//             )
//           } else if (field.type === 'references') {
//             const x = new Array(size / 4)
//             for (let j = i; j < size / 4; j += 4) {
//               x[j / 4] = result.readUint32LE(j)
//             }
//             setByPath(lastTarget, field.path, x)
//           }
//           break
//         }
//       }
//     }
//     i += size
//   }
// }
// -----------------------------------------------------------------
