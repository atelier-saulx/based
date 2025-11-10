import assert from 'assert'
import { parseReference, SchemaReference } from './reference.js'
import { parseString, SchemaString } from './string.js'
import { isRecord } from './shared.js'
import { parseReferences, type SchemaReferences } from './references.js'

export type SchemaProp<strict = true> =
  | SchemaReferences<strict>
  | SchemaReference<strict>
  | SchemaString<strict>
export type SchemaProps<strict = true> = Record<string, SchemaProp<strict>>
export type SchemaType<strict = true> =
  | { props: SchemaProps<strict> }
  | ({ props: never } & SchemaProps<strict>)
export type SchemaTypes<strict = true> = Record<string, SchemaType<strict>>
export type Schema<strict = false> = {
  types: SchemaTypes<strict>
}
export const parseProp = (def: unknown, schema: Schema): SchemaProp => {
  for (const parse of [parseString, parseReference, parseReferences]) {
    try {
      const parsed = parse(def, schema)
      // TODO: here we have to parse default!
      return parsed
    } catch (e) {}
  }
  throw 'wrong prop'
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
