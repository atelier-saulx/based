import { deepEqual } from '@saulx/utils'
import { QueryIncludeDef } from '../query/types.js'
import { FieldDef } from '../schemaTypeDef.js'
import { BasedNode } from './index.js'

export const readSeperateFieldFromBuffer = (
  requestedField: FieldDef,
  basedNode: BasedNode,
  includeDef: QueryIncludeDef = basedNode.__q.query.includeDef,
  offset: number = 4 + basedNode.__o,
  end: number = basedNode.__q.buffer.byteLength,
) => {
  const queryResponse = basedNode.__q
  const buffer = queryResponse.buffer
  const requestedFieldIndex = requestedField.field
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
    if (index === 254) {
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
        const r = includeDef.refIncludes[refField]
        if (!r) {
          throw new Error('READ BASED NODE - WRONGLY MATCHED INCLUDEDEF')
        }

        if (
          requestedField.type === 'id' &&
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
          r,
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

      if (requestedField.type === 'reference') {
        const id = buffer.readUint32LE(i + fIndex)
        if (!id) {
          return null
        }
        return {
          id,
        }
      } else if (requestedField.type === 'integer') {
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
      if (requestedField.type === 'string') {
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
      i += includeDef.mainLen
    } else {
      const size = buffer.readUInt32LE(i)
      i += 4
      // if no field add size 0
      if (found && requestedField.field === index) {
        if (requestedField.type === 'string') {
          if (size === 0) {
            return ''
          }
          return buffer.toString('utf8', i, size + i)
        }
      }
      i += size
    }
  }

  if (requestedField.type === 'string') {
    return ''
  }
  if (requestedField.type === 'references') {
    return []
  }
}
