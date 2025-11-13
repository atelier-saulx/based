import assert from 'assert'
import { isRecord, isString } from './shared.js'
import {
  numberTypes,
  parseAlias,
  parseBinary,
  parseBoolean,
  parseCardinality,
  parseEnum,
  parseJson,
  parseNumber,
  parseReference,
  parseReferences,
  parseString,
  parseText,
  parseTimestamp,
  parseVector,
  type SchemaAlias,
  type SchemaBinary,
  type SchemaBoolean,
  type SchemaCardinality,
  type SchemaEnum,
  type SchemaJson,
  type SchemaNumber,
  type SchemaReference,
  type SchemaReferences,
  type SchemaString,
  type SchemaText,
  type SchemaTimestamp,
  type SchemaVector,
} from './props/index.js'

type SchemaProps<strict = true> = Record<string, SchemaProp<strict>>
type SchemaType<strict = true> =
  | { props: SchemaProps<strict> }
  | ({ props: never } & SchemaProps<strict>)
type SchemaTypes<strict = true> = Record<string, SchemaType<strict>>
type Schema<strict = false> = {
  types: SchemaTypes<strict>
}
type SchemaProp<strict = true> =
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

const parseProp = (def: unknown, schema: Schema): SchemaProp<true> => {
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

const parseSchema = (schema: Schema): Schema<true> => {
  assert(isRecord(schema?.types))
  const types: SchemaTypes<true> = {}
  for (const key in types) {
    types[key] = parseType(schema.types[key], schema)
  }
  return {
    types,
  }
}

export {
  parseSchema,
  type SchemaAlias,
  type SchemaBinary,
  type SchemaBoolean,
  type SchemaCardinality,
  type SchemaEnum,
  type SchemaJson,
  type SchemaNumber,
  type SchemaReference,
  type SchemaReferences,
  type SchemaString,
  type SchemaText,
  type SchemaTimestamp,
  type SchemaVector,
  type SchemaProp,
  type SchemaProps,
  type SchemaType,
  type SchemaTypes,
  type Schema,
}
