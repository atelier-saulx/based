import { FieldDef } from '../schemaTypeDef.js'
import { BasedNode } from './index.js'

export const readSeperateFieldFromBuffer = (
  requestedField: FieldDef,
  basedNode: BasedNode,
) => {
  const queryResponse = basedNode.__q
  let i = 4 + basedNode.__o
  const buffer = queryResponse.buffer

  // reduce to mainLen, mainIncludes else its not good so dont add query but allow setting
  // main as well for refs...

  const requestedFieldIndex = requestedField.field

  console.log('HELLO', basedNode.__r)
  if (basedNode.__r) {
    console.info('REF VERY DIFFERENT!')
    return 'IN REF DIFFERENT!'
  }

  while (i < buffer.byteLength) {
    const index = buffer[i]

    // next node
    if (index === 255) {
      break
    }

    i += 1

    if (index === 0) {
      if (requestedFieldIndex === index) {
        let fIndex: number

        if (queryResponse.query.mainIncludes) {
          const t = queryResponse.query.mainIncludes?.[requestedField.start]
          if (!t) {
            return undefined
          }
          fIndex = t[0]
        } else {
          fIndex = requestedField.start
        }

        if (fIndex === undefined) {
          break // mep
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
          const str = buffer.toString(
            'utf-8',
            i + fIndex,
            i + fIndex + requestedField.len,
          )
          return str
        }
      }
      i += queryResponse.query.mainLen
    } else {
      const size = buffer.readUInt16LE(i)
      i += 2
      // if no field add size 0
      if (requestedField.field === index) {
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

  if (requestedField.type === 'string') {
    return ''
  }
  if (requestedField.type === 'references') {
    return []
  }
}
