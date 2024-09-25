import { Operation, operationToByte, QueryConditions } from './types.js'
import { Query } from './query.js'
import {
  isPropDef,
  SchemaTypeDef,
  SchemaPropTree,
  PropDef,
} from '../schema/schema.js'

// Query conditions: Map<number, Buffer[]>
// does not work for recursion...
// construct entire buffer for refs?

const filterReferences = (
  fieldStr: string,
  operator: Operation,
  value: any,
  schema: SchemaTypeDef,
  conditions: QueryConditions,
  query: Query,
): number => {
  var size = 0
  const path = fieldStr.split('.')
  let t: PropDef | SchemaPropTree = schema.tree
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    t = t[p]
    if (!t) {
      return
    }
    if (isPropDef(t) && t.typeIndex === 13) {
      conditions.references ??= new Map()
      let refConditions = conditions.references.get(t.prop)
      if (!refConditions) {
        const schema = query.db.schemaTypesParsed[t.inverseTypeName]
        size += 6
        refConditions = {
          conditions: new Map(),
          fromRef: t,
          schema,
        }
        conditions.references.set(t.prop, refConditions)
      }
      size += filter(
        path.slice(i + 1).join('.'),
        operator,
        value,
        refConditions.schema,
        refConditions,
        query,
      )
      return size
    }
  }

  console.error(
    `Querty: field "${fieldStr}" does not exist on type ${query.schema.type}`,
  )

  return size
}

export const filter = (
  fieldStr: string,
  operator: Operation,
  value: any,
  schema: SchemaTypeDef,
  conditions: QueryConditions,
  query: Query,
): number => {
  var size = 0
  let field = schema.props[fieldStr]

  if (!field) {
    return filterReferences(
      fieldStr,
      operator,
      value,
      schema,
      conditions,
      query,
    )
  }

  const fieldIndexChar = field.prop

  let buf: Buffer
  if (field.seperate === true) {
    if (field.typeIndex === 11) {
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
    } else if (field.typeIndex === 14) {
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
    if (field.typeIndex === 10) {
      const op = operationToByte(operator)
      // != pretty important
      if (op === 1) {
        const index = field.reverseEnum[value]
        if (index != undefined) {
          // single byte equality
          buf = Buffer.allocUnsafe(5 + 1)
          buf[0] = 1
          buf.writeInt16LE(1, 1)
          buf.writeInt16LE(field.start, 3)
          buf[5] = index + 1
        } else {
          throw new Error('incorrect val for enum!')
        }
      } else {
      }
    } else if (field.typeIndex === 11) {
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
    } else if (field.typeIndex === 5) {
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

  let arr = conditions.conditions.get(fieldIndexChar)
  if (!arr) {
    size += 3
    arr = []
    conditions.conditions.set(fieldIndexChar, arr)
  }
  size += buf.byteLength
  arr.push(buf)
  return size
}

export const fillConditionsBuffer = (
  result: Buffer,
  conditions: QueryConditions,
  offset: number,
) => {
  let lastWritten = offset
  conditions.conditions.forEach((v, k) => {
    result[lastWritten] = k
    let sizeIndex = lastWritten + 1
    lastWritten += 3
    let conditionSize = 0
    for (const condition of v) {
      conditionSize += condition.byteLength
      result.set(condition, lastWritten)
      lastWritten += condition.byteLength
    }
    result.writeInt16LE(conditionSize, sizeIndex)
  })
  if (conditions.references) {
    for (const [refField, refConditions] of conditions.references) {
      lastWritten
      result[lastWritten] = 254
      const sizeIndex = lastWritten + 1
      result[lastWritten + 3] = refField
      lastWritten += 4
      result[lastWritten] = refConditions.schema.idUint8[0]
      lastWritten += 1
      result[lastWritten] = refConditions.schema.idUint8[1]
      lastWritten += 1
      const size = fillConditionsBuffer(result, refConditions, lastWritten)
      result.writeUint16LE(size + 4, sizeIndex)
      lastWritten += size
    }
  }
  return lastWritten - offset
}

export const addConditions = (conditions: QueryConditions, size: number) => {
  let result: Buffer
  if (size > 0) {
    result = Buffer.allocUnsafe(size)
    fillConditionsBuffer(result, conditions, 0)
  } else {
    result = Buffer.alloc(0)
  }
  return result
}
