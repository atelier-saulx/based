import { Operation, operationToByte, QueryConditions } from './types.js'
import { Query } from './query.js'
import {
  isFieldDef,
  SchemaTypeDef,
  SchemaFieldTree,
  FieldDef,
} from '../schemaTypeDef.js'

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
  let t: FieldDef | SchemaFieldTree = schema.tree
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    t = t[p]
    if (!t) {
      return
    }
    if (isFieldDef(t) && t.type === 'reference') {
      const ref: FieldDef = t as FieldDef
      const refField = ref.field
      conditions.references ??= new Map()
      let refConditions = conditions.references.get(refField)
      if (!refConditions) {
        const schema = query.db.schemaTypesParsed[ref.allowedType]
        size += 6 // 254 + refField
        refConditions = {
          conditions: new Map(),
          fromRef: ref,
          schema,
        }
        conditions.references.set(refField, refConditions)
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
  let field = <FieldDef>schema.fields[fieldStr]

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

  const fieldIndexChar = field.field

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

  let arr = conditions.conditions.get(fieldIndexChar)
  if (!arr) {
    // query.totalConditionSize += 3
    size += 3
    arr = []
    conditions.conditions.set(fieldIndexChar, arr)
  }
  size += buf.byteLength
  // query.totalConditionSize += buf.byteLength
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
      result[lastWritten] = refConditions.schema.prefix[0]
      lastWritten += 1
      result[lastWritten] = refConditions.schema.prefix[1]
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
