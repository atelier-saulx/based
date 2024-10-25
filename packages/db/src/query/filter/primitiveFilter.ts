import { buffer } from 'stream/consumers'
import {
  PropDef,
  PropDefEdge,
  REFERENCES,
  BOOLEAN,
  ENUM,
  STRING,
  UINT32,
} from '../../schema/types.js'
import { QueryDefFilter } from '../types.js'

export type Operation =
  | '='
  | 'has'
  | '<'
  | '>'
  | '!='
  | 'like'
  | '>='
  | '<='
  | 'exists'
  | '!exists'

export const operationToByte = (
  op: Operation,
  field: PropDef | PropDefEdge,
) => {
  if (op === '=') {
    if (field.separate) {
      if (field.typeIndex === UINT32) {
        return 9
      }
      if (field.typeIndex === BOOLEAN || field.typeIndex === ENUM) {
        return 8
      }
      return 2
    }
    if (field.typeIndex === BOOLEAN || field.typeIndex === ENUM) {
      return 5
    }
    return 1
  }
  // 2 is non fixed length check
  if (op === '>') {
    return 3
  }

  if (op === '<') {
    return 4
  }

  if (op === 'has') {
    return 7
  }

  return 0
}

export const primitiveFilter = (
  field: PropDef | PropDefEdge,
  op: Operation,
  value: any,
  conditions: QueryDefFilter,
) => {
  const fieldIndexChar = field.prop
  var size = 0
  let buf: Buffer

  if (field.separate === true) {
    if (field.typeIndex !== REFERENCES) {
      if (op === '=') {
        if (field.typeIndex === UINT32) {
          buf = Buffer.allocUnsafe(5)
          buf[0] = operationToByte(op, field)
          buf.writeInt32LE(value, 1)
        } else if (field.typeIndex === ENUM) {
          // undefined
          const index = field.reverseEnum[value]
          if (index != undefined) {
            // single byte equality
            buf = Buffer.allocUnsafe(2)
            buf[0] = operationToByte(op, field)
            buf[1] = index + 1
          } else {
            throw new Error('incorrect val for enum!')
          }
        } else {
          const matches = Buffer.from(value)
          buf = Buffer.allocUnsafe(3 + matches.byteLength)
          buf[0] = operationToByte(op, field)
          buf.writeInt16LE(matches.byteLength, 1)
          buf.set(matches, 3)
        }
      } else if (op === 'has') {
        // TODO MAKE HAS
      }
    } else if (field.typeIndex === REFERENCES) {
      const matches = value
      const len = matches.length
      buf = Buffer.allocUnsafe(3 + len * 4)
      buf.writeInt16LE(len * 4, 1)
      if (op === '=') {
        buf[0] = operationToByte(op, field)
        for (let i = 0; i < len; i++) {
          buf.writeInt32LE(matches[i], i * 4 + 3)
        }
      } else if (op === 'has') {
        buf[0] = operationToByte(op, field)
        for (let i = 0; i < len; i++) {
          buf.writeInt32LE(matches[i], i * 4 + 3)
        }
      }
    }
  } else {
    if (field.typeIndex === BOOLEAN) {
      if (op === '=') {
        // single byte equality
        buf = Buffer.allocUnsafe(4)
        buf[0] = operationToByte(op, field)
        buf.writeInt16LE(field.start, 1)
        buf[3] = value === true ? 1 : 0
      } else {
      }
    } else if (field.typeIndex === ENUM) {
      if (op === '=') {
        const index = field.reverseEnum[value]
        if (index != undefined) {
          // single byte equality
          buf = Buffer.allocUnsafe(4)
          buf[0] = operationToByte(op, field)
          buf.writeInt16LE(field.start, 1)
          buf[3] = index + 1
        } else {
          throw new Error('incorrect val for enum!')
        }
      } else {
      }
    } else if (field.typeIndex === STRING) {
      if (op === '=') {
        const matches = Buffer.from(value)
        buf = Buffer.allocUnsafe(5 + matches.byteLength)
        buf[0] = operationToByte(op, field)
        buf.writeInt16LE(matches.byteLength, 1)
        buf.writeInt16LE(field.start, 3)
        buf.set(matches, 5)
      } else if (op === 'has') {
        // TODO MAKE HAS
      }
    } else if (field.typeIndex === UINT32) {
      if (op === '>' || op === '<' || op === '=') {
        buf = Buffer.allocUnsafe(9)
        buf[0] = operationToByte(op, field)
        buf.writeInt16LE(4, 1)
        buf.writeInt16LE(field.start, 3)
        buf.writeInt32LE(value, 5)
      }
    }
  }

  const bufferMap = field.__isEdge ? conditions.edges : conditions.conditions

  let arr = bufferMap.get(fieldIndexChar)
  if (!arr) {
    size += 3
    arr = []
    bufferMap.set(fieldIndexChar, arr)
  }
  size += buf.byteLength
  arr.push(buf)
  return size
}
