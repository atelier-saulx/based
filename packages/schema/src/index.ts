import { parseSchema, type SchemaIn, type SchemaOut } from './schema/schema.js'

export * from './types.js'
export * from './dbSchema.js'
export * from './parse/index.js'
export * from './lang.js'
export * from './def/validation.js'
export * from './serialize.js'
export * from './infer.js'
export * as semver from './parse/semver/mod.js'

export type { SchemaIn, SchemaOut }
export const parse = (schema: SchemaIn) => ({ schema: parseSchema(schema) })
