import { FieldDef, SchemaFieldTree } from '../schemaTypeDef.js'
import { BasedNode } from './BasedNode.js'

export const readSeperateFieldFromBuffer = (
  requestedField: FieldDef,
  basedNode: BasedNode,
) => {
  const queryResponse = basedNode.__q
  let i = 4 + basedNode.__o
  const buffer = queryResponse.buffer
  while (i < buffer.byteLength) {
    const index = buffer[i]
    if (index === 255) {
      return
    }
    i += 1
    if (index === 0) {
      let fIndex: number

      if (queryResponse.query.mainIncludes) {
        const t = queryResponse.query.mainIncludes?.get(requestedField.start)
        if (!t) {
          return undefined
        }
        fIndex = t[0]
      } else {
        fIndex = requestedField.start
      }

      if (fIndex === undefined) {
        return // mep
      }
      if (
        requestedField.type === 'integer' ||
        requestedField.type === 'reference'
      ) {
        return buffer.readUint32LE(i + fIndex)
      }
      if (requestedField.type === 'boolean') {
        return Boolean(buffer[i + fIndex])
      }
      if (requestedField.type === 'number') {
        return buffer.readFloatLE(i + fIndex)
      }
      if (requestedField.type === 'timestamp') {
        return buffer.readFloatLE(i + fIndex)
      }

      i += queryResponse.query.mainLen
    } else {
      const size = buffer.readUInt16LE(i)
      i += 2
      if (requestedField.field === index) {
        if (requestedField.type === 'string') {
          return buffer.toString('utf8', i, size + i)
        } else if (requestedField.type === 'references') {
          const x = new Array(size / 4)
          for (let j = i; j < size / 4; j += 4) {
            // TODO FIX
            x[j / 4] = buffer.readUint32LE(j)
          }
          return x
        }
      }
      i += size
    }
  }
}
