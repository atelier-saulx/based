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

  while (i < buffer.byteLength) {
    const index = buffer[i]

    // next node
    if (index === 255) {
      return
    }
    i += 1

    if (index === 0) {
      if (requestedFieldIndex === index) {
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
          console.log('references', size)
          const amount = size / 4
          const x = new Array(amount)
          for (let j = 0; j < amount; j++) {
            const id = buffer.readUint32LE(j * 4 + i)
            if (id) {
              x[j] = { id }
            } else {
              // TODO: means it broken BROKEN
              console.info('Broken reference cannot get id!')
              x[j] = null
            }
          }
          return x
        }
      }
      i += size
    }
  }
}
