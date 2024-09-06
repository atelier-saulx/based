import {
  Schema,
  SchemaAllProps,
  SchemaProp,
  SchemaProps,
  SchemaType,
  SchemaTypes,
} from '../types.js'
import { boolean } from './boolean.js'
import { text } from './text.js'
import { number } from './number.js'
import { getPropType, isNotObject, PropParser } from './props.js'
import { string } from './string.js'
import { timestamp } from './timestamp.js'
import { enum_ } from './enum_.js'
import { set } from './set.js'
import { reference } from './reference.js'
import { ERRORS, current } from './errors.js'

export const propParsers: Record<string, PropParser<SchemaProp>> = {
  timestamp,
  string,
  number,
  boolean,
  text,
  enum: enum_,
  set,
  reference,
} as const

export const parseProps = (
  props: Record<string, SchemaAllProps>,
  schema: Schema,
  rootOrEdgeProps: boolean = true,
) => {
  if (isNotObject(current.obj)) {
    throw Error(ERRORS.EXPECTED_OBJ)
  }
  current.obj = props
  current.key = null
  for (current.key in props) {
    const prop = props[current.key]
    if (isNotObject(prop)) {
      throw Error(ERRORS.EXPECTED_OBJ)
    }
    const propType = getPropType(prop)
    const propParser = propParsers[propType]
    if (!propParser) {
      throw Error(ERRORS.INVALID_VALUE)
    }
    propParser.parse(prop, schema, rootOrEdgeProps)
  }
}

export const parseType = (type: SchemaType, schema: Schema) => {
  if (isNotObject(type)) {
    throw Error(ERRORS.EXPECTED_OBJ)
  }
  current.obj = type
  current.key = null
  parseProps(type.props, schema, false)
}

export const parseTypes = (types: SchemaTypes, schema: Schema) => {
  if (isNotObject(types)) {
    throw Error(ERRORS.EXPECTED_OBJ)
  }
  current.obj = types
  for (current.key in types) {
    parseType(types[current.key], schema)
  }
}

export const parse = (schema: Schema) => {
  if (isNotObject(schema)) {
    throw Error(ERRORS.INVALID_SCHEMA)
  }
  try {
    current.obj = schema
    for (current.key in schema) {
      if (current.key === 'types') {
        parseTypes(schema.types, schema)
      } else if (current.key === 'props') {
        parseProps(schema.props, schema)
      } else {
        throw Error(ERRORS.UNKNOWN_PROP)
      }
    }
  } catch (e) {
    // e.cause ??= { obj, key }
    const path = e.cause.key ? [e.cause.key] : []
    const find = (t) => {
      if (t === e.cause.obj) {
        return true
      }
      if (isNotObject(t)) {
        return
      }
      for (const i in t) {
        const found = find(t[i])
        if (found) {
          path.unshift(i)
          return true
        }
      }
    }

    find(schema)

    e.message = `${path.join('.')}: ${e.message}`
    console.log('err:', e.message)
    throw e
  }
}
