import { Schema, SchemaProp, SchemaProps, SchemaTypes } from '../types.js'
import { boolean } from './boolean.js'
import { text } from './text.js'
import { number } from './number.js'
import { getPropType, isNotObject, PropParser } from './props.js'
import { string } from './string.js'
import { timestamp } from './timestamp.js'
import { enum_ } from './enum_.js'
import { set } from './set.js'
import { reference } from './reference.js'
import { ERRORS } from './errors.js'

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

const schemaParsers: Record<
  string,
  (val: any, schema: Schema, inRootProps?: boolean) => void
> = {
  props(props: SchemaProps, schema: Schema, inRootProps: boolean = true) {
    if (isNotObject(props)) {
      throw Error(ERRORS.EXPECTED_OBJ)
    }
    for (const key in props) {
      const prop = props[key]
      if (isNotObject(prop)) {
        throw Error(ERRORS.EXPECTED_OBJ)
      }
      const propType = getPropType(prop)
      const propParser = propParsers[propType]
      if (!propParser) {
        throw Error(ERRORS.INVALID_VALUE)
      }
      propParser.parse(prop, schema, inRootProps)
    }
  },
  types(types: SchemaTypes, schema: Schema) {
    if (isNotObject(types)) {
      throw Error(ERRORS.EXPECTED_OBJ)
    }
    for (const key in types) {
      const nodeType = types[key]
      if (isNotObject(nodeType)) {
        throw Error(ERRORS.EXPECTED_OBJ)
      }
      const { props } = nodeType
      schemaParsers.props(props, schema, false)
    }
  },
} as const

export const parse = (schema: Schema) => {
  if (isNotObject(schema)) {
    throw Error(ERRORS.INVALID_SCHEMA)
  }
  let key, obj
  try {
    for (const key in schema) {
      const schemaParser = schemaParsers[key]
      if (!schemaParser) {
        throw Error(ERRORS.UNKNOWN_PROP)
      }
      schemaParser(schema[key], schema)
    }
  } catch (e) {
    if (e.cause) {
      obj = e.cause.obj
      key = e.cause.key
    } else {
      obj = schema
    }
    const path = key ? [key] : []
    const find = (t) => {
      if (t === obj) {
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
