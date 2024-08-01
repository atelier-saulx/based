import { FieldDef } from '../schemaTypeDef.js'
import { BasedNode } from './index.js'

const includePathsAreEqual = (
  includePath: number[],
  refPath: number[],
  start: number,
): boolean => {
  for (let i = 0; i < refPath.length - 1; i++) {
    if (includePath[i] !== refPath[i]) {
      return false
    }
  }
  if (start !== refPath[refPath.length - 1]) {
    return false
  }
  return true
}

export const readSeperateFieldFromBuffer = (
  requestedField: FieldDef,
  basedNode: BasedNode,
) => {
  const queryResponse = basedNode.__q
  let i = 4 + basedNode.__o
  const buffer = queryResponse.buffer
  const requestedFieldIndex = requestedField.field
  const ref = basedNode.__r
  const refStart = ref?.fromRef.start

  let found = !ref || false
  let includeDef = queryResponse.query.includeDef

  let logg = false

  // problem is START is equal
  if (ref) {
    if (ref?.fromRef?.path[0] === 'myBlup') {
      // console.log('\n GET MY BLUP FIELD', requestedField.path, ref.includePath)
      // logg = true
    }
  }

  while (i < buffer.byteLength) {
    let index = buffer[i]

    // next node
    if (index === 255) {
      break
    }

    i += 1

    if (logg) {
      console.log(
        { index },
        includeDef?.fromRef?.path ?? '[NOT FROM REF]',
        includeDef.includePath,
      )
    }

    if ((!found || !ref) && index === 254) {
      const start = buffer.readUint16LE(i + 1)

      const resetNested = buffer[i] === 0
      if (resetNested) {
        includeDef = queryResponse.query.includeDef
      }

      // console.log(includeDef.includePath)

      if (
        ref &&
        includePathsAreEqual(includeDef.includePath, ref.includePath, start)
      ) {
        // console.info('FOUND!', start)
        if (requestedField.type === 'id') {
          return buffer.readUint32LE(i + 3)
        }
        found = true
        i += 7
        includeDef = ref
      } else {
        i += 7
        includeDef = includeDef.refIncludes[start]
      }

      // console.log(
      //   '1 .ref get field',
      //   start,
      //   requestedField.path,
      //   ref?.fromRef?.path ?? '[NO REF]',
      // )

      continue
    }

    if (index === 0) {
      if (requestedFieldIndex !== index || !found) {
        i += includeDef.mainLen
        continue
      }

      let fIndex: number

      if (includeDef.mainIncludes) {
        const t = includeDef.mainIncludes?.[requestedField.start]
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
        const str = buffer.toString(
          'utf-8',
          i + fIndex + 1,
          i + fIndex + len + 1,
        )
        return str
      }
      i += includeDef.mainLen
    } else {
      const size = buffer.readUInt16LE(i)
      i += 2
      // if no field add size 0
      if (requestedField.field === index && found) {
        if (requestedField.type === 'string') {
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
