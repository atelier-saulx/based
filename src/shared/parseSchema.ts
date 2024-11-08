import type { BundleResult } from '@based/bundle'

export const parseSchema = (bundleResult: BundleResult, schema: string) => {
  const compiledSchema = bundleResult.require(schema)
  let schemaPayload = compiledSchema.default || compiledSchema

  if (!Array.isArray(schemaPayload)) {
    if (!schemaPayload.schema) {
      schemaPayload = { schema: schemaPayload }
    }
    schemaPayload = [schemaPayload]
  }

  return schemaPayload
}
