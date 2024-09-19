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

  // console.log(
  //   ref.includePath.map((v) => '-').join(''),
  //   'GET FIELD',
  //   requestedField.type,
  //   requestedField.path,
  //   includeDef.includePath,
  //   ref.includePath,
  //   offset,
  //   end,
  // )

  while (i < end) {
    let index = buffer[i]

    // next node
    if (index === 255) {
      break
    }

    i += 1

    // console.log({ index })

    // index === 253 or 254
    if (index === 254) {
      const size = buffer.readUInt32LE(i + 1)
      const refField = buffer[i]

      if (includeDef.includePath.length > 1) {
        console.log({ ref: !!ref })
      }

      if (!ref) {
        i += 5 + size
        continue
      }

      // console.log({
      //   fType: requestedField.type,
      //   refField,
      //   size,
      //   i,
      //   END: i + 5 + size,
      // })
      // console.log(ref.includePath, ref.fromRef?.path, includeDef.includePath)

      if (includeDef.includePath.length > ref.includePath.length) {
        i += 5 + size
        continue
      }

      let pIndex = 0
      for (pIndex = 0; pIndex < ref.includePath.length; pIndex++) {
        if (includeDef.includePath[pIndex] === undefined) {
          // return i
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
          throw new Error('IN WRONG MATCHED INCLUDE')
        }

        if (
          requestedField.type === 'id' &&
          pIndex === ref.includePath.length - 1
        ) {
          if (size === 0) {
            return null
          }
          // console.log('     ID:', { i, id: buffer.readUint32LE(i + 5 + 1) })

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
        } else if (requestedField.type === 'references') {
          const amount = size / 4
          const x = new Array(amount)
          for (let j = 0; j < amount; j++) {
            const id = buffer.readUint32LE(j * 4 + i)
            if (id) {
              x[j] = { id }
            } else {
              console.warn(
                'BasedNode ref reader: Broken reference cannot get id!',
              )
              x.splice(j, 1)
            }
          }
          return x
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
