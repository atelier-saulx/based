import { deepEqual } from '@saulx/utils'
import { QueryIncludeDef } from '../query/types.js'
import { PropDef } from '../schema/schema.js'
import { BasedNode } from './index.js'
import { BasedQueryResponse } from '../query/BasedQueryResponse.js'

export const readSeperateFieldFromBuffer = (
  requestedField: PropDef,
  basedNode: BasedNode,
  includeDef: QueryIncludeDef = basedNode.__q.includeDef,
  offset: number = 4 + basedNode.__o,
  end: number = basedNode.__q.end,
) => {
  const queryResponse = basedNode.__q
  const buffer = queryResponse.buffer
  const requestedFieldIndex = requestedField.prop
  const ref = basedNode.__r

  let found = true

  if (ref) {
    found = deepEqual(ref.includePath, includeDef.includePath)
  }

  let i = offset

  while (i < end) {
    let index = buffer[i]

    // next node
    if (index === 255) {
      break
    }

    i += 1

    // index === 253 or 254
    if (index === 253) {
      const size = buffer.readUInt32LE(i + 1)

      if (!found) {
        i += 9 + size
        continue
      }

      const refField = buffer[i]

      if (
        // 14: refeewnces
        requestedField.typeIndex === 14 &&
        requestedField.prop === refField
      ) {
        const include = includeDef.refIncludes[refField]
        // this is tmp... very inefficient
        const refResp = new BasedQueryResponse(
          basedNode.__q.query,
          buffer,
          i + 5,
          size + 9 + i,
          include,
          include.schema,
          null,
        )
        return refResp
      }

      i += 9 + size
      continue
    } else if (index === 254) {
      const size = buffer.readUInt32LE(i + 1)

      if (found || !ref) {
        i += 5 + size
        continue
      }

      const refField = buffer[i]

      if (includeDef.includePath.length > ref.includePath.length) {
        i += 5 + size
        continue
      }

      let pIndex = 0
      for (pIndex = 0; pIndex < ref.includePath.length; pIndex++) {
        if (includeDef.includePath[pIndex] === undefined) {
          break
        }
        if (includeDef.includePath[pIndex] !== ref.includePath[pIndex]) {
          pIndex = -1
          break
        }
      }

      if (pIndex == -1) {
        i += 5 + size
        continue
      }

      if (refField === ref.includePath[pIndex]) {
        const singleRef = includeDef.refIncludes[refField]
        if (!singleRef) {
          throw new Error('READ BASED NODE - WRONGLY MATCHED INCLUDEDEF')
        }

        if (
          // 0: id
          requestedField.typeIndex === 0 &&
          pIndex === ref.includePath.length - 1
        ) {
          if (size === 0) {
            return null
          }
          return buffer.readUint32LE(i + 5 + 1)
        }

        if (size === 0) {
          i += 5
          continue
        }

        return readSeperateFieldFromBuffer(
          requestedField,
          basedNode,
          singleRef,
          i + 5 + 5,
          i + 5 + size,
        )
      }

      i += 5 + size
      continue
    }

    if (index === 0) {
      if (!found || requestedFieldIndex !== index) {
        i += includeDef.mainLen
        continue
      }

      let fIndex: number

      if (includeDef.mainIncludes) {
        const t = includeDef.mainIncludes[requestedField.start]
        if (!t) {
          return undefined
        }
        fIndex = t[0]
      } else {
        fIndex = requestedField.start
      }

      if (fIndex === undefined) {
        break
      }

      // 13: Reference
      if (requestedField.typeIndex === 13) {
        const id = buffer.readUint32LE(i + fIndex)
        if (!id) {
          return null
        }
        return {
          id,
        }
      }

      // 9: Boolean
      if (requestedField.typeIndex === 9) {
        return Boolean(buffer[i + fIndex])
      }

      // 1: timestamp, 4: number
      if (requestedField.typeIndex === 4 || requestedField.typeIndex === 1) {
        return buffer.readDoubleLE(i + fIndex)
      }

      // 10: Enum
      if (requestedField.typeIndex === 10) {
        const index = buffer[i + fIndex]
        if (index === 0) {
          return undefined
        }
        return requestedField.enum[index - 1]
      }

      // 11: String
      if (requestedField.typeIndex === 11) {
        const len = buffer[i + fIndex]
        if (len === 0) {
          return ''
        }
        const str = buffer.toString(
          'utf-8',
          i + fIndex + 1,
          i + fIndex + len + 1,
        )
        return str
      }

      // 18: int8
      if (requestedField.typeIndex === 18) {
        return buffer.readInt8(i + fIndex)
      }

      // 19: uint8
      if (requestedField.typeIndex === 19) {
        return buffer.readUint8(i + fIndex)
      }

      // 20: int16
      if (requestedField.typeIndex === 20) {
        return buffer.readInt16LE(i + fIndex)
      }

      // 21: uint16
      if (requestedField.typeIndex === 21) {
        return buffer.readUint16LE(i + fIndex)
      }

      // 22: int32
      if (requestedField.typeIndex === 22) {
        return buffer.readInt32LE(i + fIndex)
      }

      // 5: uint32
      if (requestedField.typeIndex === 5) {
        return buffer.readUint32LE(i + fIndex)
      }

      i += includeDef.mainLen
    } else {
      const size = buffer.readUInt32LE(i)
      i += 4
      // if no field add size 0
      if (found && requestedField.prop === index) {
        // 11: String
        if (requestedField.typeIndex === 11) {
          if (size === 0) {
            return ''
          }
          return buffer.toString('utf8', i, size + i)
        }
      }
      i += size
    }
  }

  // 11: string
  if (requestedField.typeIndex === 11) {
    return ''
  }

  // 14: References
  if (requestedField.typeIndex === 14) {
    return []
  }
}
