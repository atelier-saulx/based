import type { BundleResult } from '@based/bundle'

export const schemaPrepare = (path: string, nodeBundles: BundleResult) => {
  const bundled = nodeBundles.require(path)

  if (bundled) {
    let bundledSchema = bundled.default || bundled

    if (!Array.isArray(bundledSchema)) {
      if (!bundledSchema.schema) {
        bundledSchema = { schema: bundledSchema }
      }

      bundledSchema = [bundledSchema]

      return bundledSchema[0].schema
    }
  }

  return undefined
}
