import {
  parseSchema,
  type SchemaIn,
  type SchemaOut,
  type StrictSchema,
} from './schema/schema.js'

export * from './schema/alias.js'
export * from './schema/base.js'
export * from './schema/binary.js'
export * from './schema/boolean.js'
export * from './schema/cardinality.js'
export * from './schema/enum.js'
export * from './schema/hooks.js'
export * from './schema/json.js'
export * from './schema/number.js'
export * from './schema/object.js'
export * from './schema/prop.js'
export * from './schema/reference.js'
export * from './schema/references.js'
export * from './schema/schema.js'
export * from './schema/shared.js'
export * from './schema/string.js'
export * from './schema/timestamp.js'
export * from './schema/type.js'
export * from './schema/vector.js'
export * from './serialize.js'
export * from './infer.js'
export * as semver from './semver/mod.js'

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

// eslint-disable-next-line
export const parse = <S extends SchemaIn>(
  schema: StrictSchema<S>,
): { schema: SchemaOut } => ({
  schema: parseSchema(schema as any) as unknown as SchemaOut,
})
export const MAX_ID = 4294967295
export const MIN_ID = 1

export type { SchemaIn, SchemaOut }
