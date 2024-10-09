import { QueryDef, QueryDefFilter, QueryDefShared } from '../types.js'
import {
  isPropDef,
  SchemaTypeDef,
  SchemaPropTree,
  PropDef,
} from '../../schema/schema.js'
import { BasedDb } from '../../index.js'

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

export const operationToByte = (op: Operation) => {
  // useless remove this just constants...
  // also put this in filter
  if (op === '=') {
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

const filterReferences = (
  db: BasedDb,
  fieldStr: string,
  operator: Operation,
  value: any,
  schema: SchemaTypeDef,
  conditions: QueryDef['filter'],
): number => {
  var size = 0
  const path = fieldStr.split('.')
  let t: PropDef | SchemaPropTree = schema.tree
  for (let i = 0; i < path.length; i++) {
    const p = path[i]

    t = t[p]
    if (!t) {
      return size
    }
    if (isPropDef(t) && t.typeIndex === 13) {
      conditions.references ??= new Map()
      let refConditions = conditions.references.get(t.prop)
      if (!refConditions) {
        const schema = db.schemaTypesParsed[t.inverseTypeName]
        size += 6
        refConditions = {
          conditions: new Map(),
          fromRef: t,
          schema,
          size: 0,
        }
        conditions.references.set(t.prop, refConditions)
      }
      size += filterRaw(
        db,
        path.slice(i + 1).join('.'),
        operator,
        value,
        refConditions.schema,
        refConditions,
      )
      return size
    }
  }

  console.error(
    `Querty: field "${fieldStr}" does not exist on type ${schema.type}`,
  )

  return size
}

export const filterRaw = (
  db: BasedDb,
  fieldStr: string,
  operator: Operation,
  value: any,
  schema: SchemaTypeDef,
  conditions: QueryDefFilter,
): number => {
  var size = 0
  let field = schema.props[fieldStr]

  if (!field) {
    return filterReferences(db, fieldStr, operator, value, schema, conditions)
  }

  const fieldIndexChar = field.prop

  let buf: Buffer
  if (field.separate === true) {
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
    if (field.typeIndex === 9) {
      const op = operationToByte(operator)
      // != pretty important
      if (op === 1) {
        // single byte equality
        buf = Buffer.allocUnsafe(4)
        buf[0] = 5
        buf.writeInt16LE(field.start, 1)
        buf[3] = value === true ? 1 : 0
      } else {
      }
    } else if (field.typeIndex === 10) {
      const op = operationToByte(operator)
      // != pretty important
      if (op === 1) {
        const index = field.reverseEnum[value]
        if (index != undefined) {
          // single byte equality
          buf = Buffer.allocUnsafe(4)
          buf[0] = 5
          buf.writeInt16LE(field.start, 1)
          buf[3] = index + 1
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

export const filter = (
  db: BasedDb,
  def: QueryDef,
  fieldStr: string,
  operator: Operation,
  value: any,
) => {
  def.filter.size += filterRaw(
    db,
    fieldStr,
    operator,
    value,
    def.schema,
    def.filter,
  )
}
