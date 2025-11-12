import assert from 'assert'
import { parseReference, SchemaReference } from './reference.js'
import { parseString, SchemaString } from './string.js'
import { isRecord, isString } from './shared.js'
import { parseReferences, type SchemaReferences } from './references.js'
import { parseAlias, type SchemaAlias } from './alias.js'
import { parseBinary, type SchemaBinary } from './binary.js'
import { parseBoolean, type SchemaBoolean } from './boolean.js'
import { parseCardinality, type SchemaCardinality } from './cardinality.js'
import { parseEnum, type SchemaEnum } from './enum.js'
import { parseJson, type SchemaJson } from './json.js'
import { parseText, type SchemaText } from './text.js'
import { parseTimestamp, type SchemaTimestamp } from './timestamp.js'
import { parseNumber, type SchemaNumber } from './number.js'

export type SchemaProp<strict = true> =
  | SchemaAlias
  | SchemaBinary
  | SchemaBoolean
  | SchemaCardinality
  | SchemaEnum<strict>
  | SchemaJson
  | SchemaNumber
  | SchemaReferences<strict>
  | SchemaReference<strict>
  | SchemaString
  | SchemaText
  | SchemaTimestamp

export type SchemaProps<strict = true> = Record<string, SchemaProp<strict>>
export type SchemaType<strict = true> =
  | { props: SchemaProps<strict> }
  | ({ props: never } & SchemaProps<strict>)
export type SchemaTypes<strict = true> = Record<string, SchemaType<strict>>
export type Schema<strict = false> = {
  types: SchemaTypes<strict>
}

export const parseProp = (def: unknown, schema: Schema): SchemaProp<true> => {
  if (isString(def)) {
    def = { type: def }
  } else if (Array.isArray(def)) {
    def = { enum: def }
  }

  assert(isRecord(def))

  // const type =
  //   def.type || 'enum' in def
  //     ? 'enum'
  //     : 'ref' in def
  //       ? 'reference'
  //       : 'items' in def
  //         ? 'references'
  //         : undefined

  switch (def.type) {
    case 'alias':
      return parseAlias(def)
    case 'binary':
      return parseBinary(def)
    case 'boolean':
      return parseBoolean(def)
    case 'cardinality':
      return parseCardinality(def)
    case 'enum':
      return parseEnum(def)
    case 'json':
      return parseJson(def)
    case 'number':
      return parseNumber(def)
    case 'reference':
      return parseReference(def, schema)
    case 'references':
      return parseReferences(def, schema)
    case 'string':
      return parseString(def)
    case 'text':
      return parseText(def)
    case 'timestamp':
      return parseTimestamp(def)
  }

  throw 'error'
}

const parseType = (type: unknown, schema: Schema): SchemaType<true> => {
  assert(isRecord(type))
  const typeProps = type.props ?? type
  assert(isRecord(typeProps))
  const props: SchemaProps<true> = {}
  for (const key in typeProps) {
    props[key] = parseProp(typeProps[key], schema)
  }
  return {
    props,
  }
}

export const parseSchema = (schema: Schema): Schema<true> => {
  assert(isRecord(schema?.types))
  const types: SchemaTypes<true> = {}
  for (const key in types) {
    types[key] = parseType(schema.types[key], schema)
  }
  return {
    types,
  }
}
