import { createEmptyDef } from './def/createEmptyDef.js'
import { DEFAULT_MAP } from './def/defaultMap.js'
import { updateTypeDefs } from './def/typeDef.js'
import {
  isPropDef,
  type PropDef,
  type PropDefEdge,
  type SchemaPropTree,
  type SchemaTypeDef,
  REVERSE_TYPE_INDEX_MAP,
  ID_FIELD_DEF,
  VECTOR_BASE_TYPE_SIZE_MAP,
  EMPTY_MICRO_BUFFER,
  BLOCK_CAPACITY_DEFAULT,
  VectorBaseType,
} from './def/types.js'
import { propIsNumerical } from './def/utils.js'
import { parseSchema, type SchemaIn, type SchemaOut } from './schema/schema.js'

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
export * from './schema/text.js'
export * from './schema/timestamp.js'
export * from './schema/type.js'
export * from './schema/vector.js'

export * from './lang.js'
export * from './def/validation.js'
// export * from './def/types.js'
export * from './serialize.js'
export * from './infer.js'
export * as semver from './semver/mod.js'

export const parse = (schema: SchemaIn): { schema: SchemaOut } => ({
  schema: parseSchema(schema),
})
export const MAX_ID = 4294967295
export const MIN_ID = 1

export type { SchemaIn, SchemaOut }

// defs (to be removed/updated) ==============
export type { SchemaTypeDef, PropDef, PropDefEdge, SchemaPropTree }
export {
  REVERSE_TYPE_INDEX_MAP,
  isPropDef,
  ID_FIELD_DEF,
  propIsNumerical,
  createEmptyDef,
  DEFAULT_MAP,
  VECTOR_BASE_TYPE_SIZE_MAP,
  EMPTY_MICRO_BUFFER,
  updateTypeDefs,
  BLOCK_CAPACITY_DEFAULT,
  VectorBaseType,
}
// ===========================================
