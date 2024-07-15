import { Operation, operationToByte } from './types.js'
import { Query } from './query.js'
import { FieldDef } from '../index.js'

export const filter = (
  query: Query,
  fieldStr: string,
  operator: Operation,
  value: any,
): Query => {
  if (query.id) {
    // do things
  } else {
    const field = <FieldDef>query.type.tree[fieldStr]
    let fieldIndexChar = field.field
    let buf: Buffer
    if (field.seperate === true) {
      if (field.type === 'string') {
        const op = operationToByte(operator)
        if (op === 1) {
          const matches = Buffer.from(value)
          buf = Buffer.allocUnsafe(3 + matches.byteLength)
          buf[0] = 2
          buf.writeInt16LE(matches.byteLength, 1)
          buf.set(matches, 3)
        } else if (op === 7) {
          // TODO MAKE HAS
        }
      } else if (field.type === 'references') {
        const op = operationToByte(operator)
        const matches = value
        const len = matches.length
        buf = Buffer.allocUnsafe(3 + len * 4)
        buf.writeInt16LE(len * 4, 1)
        if (op === 1) {
          buf[0] = 2
          for (let i = 0; i < len; i++) {
            buf.writeInt32LE(matches[i], i * 4 + 3)
          }
        } else if (op === 7) {
          buf[0] = op
          for (let i = 0; i < len; i++) {
            buf.writeInt32LE(matches[i], i * 4 + 3)
          }
        }
      }
    } else {
      if (field.type === 'string') {
        const op = operationToByte(operator)
        if (op === 1) {
          const matches = Buffer.from(value)
          buf = Buffer.allocUnsafe(5 + matches.byteLength)
          buf[0] = 1
          buf.writeInt16LE(matches.byteLength, 1)
          buf.writeInt16LE(field.start, 3)
          buf.set(matches, 5)
        } else if (op === 7) {
          // TODO MAKE HAS
        }
      } else if (field.type === 'integer') {
        const op = operationToByte(operator)
        if (op === 1 || op === 3 || op === 4) {
          buf = Buffer.allocUnsafe(9)
          buf[0] = op
          buf.writeInt16LE(4, 1)
          buf.writeInt16LE(field.start, 3)
          buf.writeInt32LE(value, 5)
        }
      }
    }
    query.conditions ??= new Map()
    let arr = query.conditions.get(fieldIndexChar)
    if (!arr) {
      query.totalConditionSize += 3
      arr = []
      query.conditions.set(fieldIndexChar, arr)
    }
    query.totalConditionSize += buf.byteLength
    arr.push(buf)
    return query
  }
}
