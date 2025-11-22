import { assert, isRecord, isString } from './shared.js'
import { parseAlias, type SchemaAlias } from './alias.js'
import { parseBinary, type SchemaBinary } from './binary.js'
import { parseBoolean, type SchemaBoolean } from './boolean.js'
import { parseCardinality, type SchemaCardinality } from './cardinality.js'
import { parseEnum, type EnumItem, type SchemaEnum } from './enum.js'
import { parseJson, type SchemaJson } from './json.js'
import {
  numberTypes,
  parseNumber,
  type NumberType,
  type SchemaNumber,
} from './number.js'
import { parseReferences, type SchemaReferences } from './references.js'
import { parseReference, type SchemaReference } from './reference.js'
import { parseString, type SchemaString } from './string.js'
import { parseText, type SchemaText } from './text.js'
import { parseTimestamp, type SchemaTimestamp } from './timestamp.js'
import { parseVector, type SchemaVector } from './vector.js'
import { parseObject, type SchemaObject } from './object.js'

type SchemaPropObj<strict = false> =
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
  | SchemaVector
  | SchemaObject<strict>

type SchemaPropShorthand =
  | 'timestamp'
  | 'binary'
  | 'boolean'
  | 'string'
  | 'alias'
  | 'text'
  | 'json'
  | 'cardinality'
  | NumberType
  | EnumItem[]

export type SchemaProp<strict = false> =
  | SchemaPropObj<strict>
  | (strict extends true ? never : SchemaPropShorthand)

export const parseProp = (
  parent: Record<string, unknown>,
  key: string,
): SchemaProp<true> => {
  let def = parent[key]
  if (isString(def)) {
    def = { type: def }
  } else if (Array.isArray(def)) {
    def = { enum: def }
  }

  assert(isRecord(def), 'Invalid property')

  let type = def.type

  if (type === undefined) {
    if ('enum' in def) {
      type = 'enum'
    } else if ('props' in def) {
      type = 'object'
    } else if ('ref' in def) {
      type = 'reference'
    } else if ('items' in def) {
      type = 'references'
    }
  }
  if (type === 'object') {
    return parseObject(def)
  } else if (type === 'alias') {
    return parseAlias(def)
  } else if (type === 'binary') {
    return parseBinary(def)
  } else if (type === 'boolean') {
    return parseBoolean(def)
  } else if (type === 'cardinality') {
    return parseCardinality(def)
  } else if (type === 'enum') {
    return parseEnum(def)
  } else if (type === 'json') {
    return parseJson(def)
  } else if (type === 'reference') {
    return parseReference(def)
  } else if (type === 'references') {
    return parseReferences(def)
  } else if (type === 'string') {
    return parseString(def)
  } else if (type === 'text') {
    return parseText(def)
  } else if (type === 'timestamp') {
    return parseTimestamp(def)
  } else if (type === 'vector' || type === 'colvec') {
    return parseVector(def)
  } else if (numberTypes.includes(type as any)) {
    return parseNumber(def)
  }

  throw 'Unknown property'
}
