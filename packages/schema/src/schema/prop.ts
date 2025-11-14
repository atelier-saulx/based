import { assert, isRecord, isString } from './shared.js'
import { parseAlias, type SchemaAlias } from './alias.js'
import { parseBinary, type SchemaBinary } from './binary.js'
import { parseBoolean, type SchemaBoolean } from './boolean.js'
import { parseCardinality, type SchemaCardinality } from './cardinality.js'
import { parseEnum, type SchemaEnum } from './enum.js'
import { parseJson, type SchemaJson } from './json.js'
import { numberTypes, parseNumber, type SchemaNumber } from './number.js'
import { parseReferences, type SchemaReferences } from './references.js'
import { parseReference, type SchemaReference } from './reference.js'
import { parseString, type SchemaString } from './string.js'
import { parseText, type SchemaText } from './text.js'
import { parseTimestamp, type SchemaTimestamp } from './timestamp.js'
import { parseVector, type SchemaVector } from './vector.js'
import type { Schema } from './schema.js'

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
  | SchemaVector

export const parseProp = (def: unknown, schema: Schema): SchemaProp<true> => {
  if (isString(def)) {
    def = { type: def }
  } else if (Array.isArray(def)) {
    def = { enum: def }
  }

  assert(isRecord(def))

  let type = def.type
  type ??=
    'enum' in def
      ? 'enum'
      : 'ref' in def
        ? 'reference'
        : 'items' in def
          ? 'references'
          : undefined

  if (type === 'alias') {
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
    return parseReference(def, schema)
  } else if (type === 'references') {
    return parseReferences(def, schema)
  } else if (type === 'string') {
    return parseString(def)
  } else if (type === 'text') {
    return parseText(def)
  } else if (type === 'timestamp') {
    return parseTimestamp(def)
  } else if (type === 'vector' || type === 'colvec') {
    return parseVector(def)
  } else if (numberTypes.includes(type as string)) {
    return parseNumber(def)
  }

  throw 'error'
}
