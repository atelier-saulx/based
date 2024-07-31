import { FieldDef } from '../schemaTypeDef.js'
import { BasedNode } from './index.js'

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

  let mainIncludes = queryResponse.query.includeDef.mainIncludes
  let mainLen = queryResponse.query.includeDef.mainLen
  let found = !ref || false
  let includeDef = queryResponse.query.includeDef

  // console.info('BLA -->', ref)

  while (i < buffer.byteLength) {
    let index = buffer[i]

    // next node
    if (index === 255) {
      break
    }

    i += 1

    // REF --------------------------
    if ((!found || !ref) && index === 254) {
      const start = buffer.readUint16LE(i + 1)
      const resetNested = buffer[i] === 0
      if (resetNested) {
        includeDef = queryResponse.query.includeDef
      }

      if (ref && start === refStart) {
        if (requestedField.type === 'id') {
          return buffer.readUint32LE(i + 3)
        }
        found = true
        i += 3 + 4
        if (ref.mainLen) {
          mainLen = ref.mainLen
          mainIncludes = ref.mainIncludes
        }
        index = buffer[i]
        i += 1
        includeDef = ref
      } else {
        i += 3 + 4

        if (!includeDef.refIncludes?.[start]) {
          console.warn('CANNOT FIND REF INCLUDE', start, includeDef)
        }

        if (includeDef.refIncludes[start].mainLen) {
          mainLen = includeDef.refIncludes[start].mainLen
          mainIncludes = includeDef.refIncludes[start].mainIncludes
        }
        index = buffer[i]
        includeDef = includeDef.refIncludes[start]
        i += 1
      }
    }
    // --------------------------

    if (index === 0) {
      if (requestedFieldIndex === index && found) {
        let fIndex: number

        if (mainIncludes) {
          const t = mainIncludes?.[requestedField.start]
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
      }
      i += mainLen

      // reset incorrect like this ofc
      mainLen = queryResponse.query.includeDef.mainLen
      mainIncludes = queryResponse.query.includeDef.mainIncludes
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
              console.info('Broken reference cannot get id!')
              // x[j] = null
              x.splice(j, 1)
            }
          }
          return x
        }
      }
      i += size
    }
  }

  // not in there...
  if (requestedField.type === 'string') {
    return ''
  }
  if (requestedField.type === 'references') {
    return []
  }
}
