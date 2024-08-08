import { Operation, operationToByte, QueryConditions } from './types.js'
import { Query } from './query.js'
import {
  isFieldDef,
  SchemaTypeDef,
  SchemaFieldTree,
  FieldDef,
} from '../schemaTypeDef.js'
import { BasedDb } from '../index.js'

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
) => {
  const path = fieldStr.split('.')
  // pass nested schema

  let t: FieldDef | SchemaFieldTree = schema.tree
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    t = t[p]
    if (!t) {
      return
    }
    if (isFieldDef(t) && t.type === 'reference') {
      const ref: FieldDef = t as FieldDef
      const start = ref.start
      conditions.references ??= new Map()
      let refConditions = conditions.references.get(start)
      if (!refConditions) {
        const schema = query.db.schemaTypesParsed[ref.allowedType]
        query.totalConditionSize += 7 // 254 + start
        refConditions = {
          conditions: new Map(),
          fromRef: ref,
          schema,
        }
        conditions.references.set(start, refConditions)
      }
      filter(
        path.slice(i + 1).join('.'),
        operator,
        value,
        refConditions.schema,
        refConditions,
        query,
      )
      return
    }
  }

  console.error(
    `Querty: field "${fieldStr}" does not exist on type ${query.schema.type}`,
  )

  return
}

export const filter = (
  fieldStr: string,
  operator: Operation,
  value: any,
  schema: SchemaTypeDef,
  conditions: QueryConditions,
  query: Query,
) => {
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
    query.totalConditionSize += 3
    arr = []
    conditions.conditions.set(fieldIndexChar, arr)
  }
  query.totalConditionSize += buf.byteLength
  arr.push(buf)

  return
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
    for (const [refStart, refConditions] of conditions.references) {
      lastWritten
      result[lastWritten] = 254
      const sizeIndex = lastWritten + 1
      result.writeUint16LE(refStart, lastWritten + 3)
      lastWritten += 5
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

export const addConditions = (query: Query) => {
  let result: Buffer
  if (query.totalConditionSize > 0) {
    result = Buffer.allocUnsafe(query.totalConditionSize)
    fillConditionsBuffer(result, query.conditions, 0)
  } else {
    result = Buffer.alloc(0)
  }
  return result
}
