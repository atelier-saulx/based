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

  const refStart = ref?.field.start

  let mainIncludes = queryResponse.query.mainIncludes
  let mainLen = queryResponse.query.mainLen
  let found = !ref || false

  while (i < buffer.byteLength) {
    let index = buffer[i]

    // next node
    if (index === 255) {
      break
    }

    i += 1

    // REF --------------------------
    if (
      (!found || !ref) &&
      index === 0 &&
      buffer[i] === 254 &&
      queryResponse.query.refIncludes
    ) {
      const start = buffer.readUint16LE(i + 1)
      if (ref && start === refStart) {
        found = true
        i += 3
        if (ref.mainLen) {
          mainLen = ref.mainLen
          mainIncludes = ref.mainFields
        }
        index = buffer[i]
        i += 1

        console.info('     SELECT REF - next')
      } else {
        i += 3
        index = buffer[i]
        if (queryResponse.query.refIncludes[0].mainLen) {
          mainLen = queryResponse.query.refIncludes[0].mainLen
          mainIncludes = queryResponse.query.refIncludes[0].mainFields
        }
        i += 1
        // set these to the correct ref...
        // mainLen = ref.mainLen
        // mainIncludes = ref.mainFields
        // TODO: skip to next ref
        // get ref leng from includes

        console.info('switch')
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
          // read len
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

      // reset
      mainLen = queryResponse.query.mainLen
      mainIncludes = queryResponse.query.mainIncludes
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
