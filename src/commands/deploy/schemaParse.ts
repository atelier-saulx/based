import type { BundleResult } from '@based/bundle'
import type { AppContext } from '../../context/index.js'
import { isSchemaFile, rel, stringMaxLength } from '../../shared/index.js'

export const schemaParse = async (
  context: AppContext,
  configs: Based.Deploy.Functions[],
  nodeBundles: BundleResult,
): Promise<Based.Deploy.Functions> => {
  context.print
    .line()
    .intro(context.i18n('methods.bundling.loadingSchema'))
    .pipe()
  const pipe: string = '<dim>|</dim>'

  const schema = await Promise.all(
    configs
      .map(async ({ path }) => {
        if (!isSchemaFile(path)) {
          return false
        }

        const bundled = nodeBundles.require(path)

        if (bundled) {
          let bundledSchema = bundled.default || bundled

          if (!Array.isArray(bundledSchema)) {
            if (!bundledSchema.schema) {
              bundledSchema = { schema: bundledSchema }
            }

            bundledSchema = [bundledSchema]
          }

          const dbNames = bundledSchema.map(({ db = 'default' }) => db)

          for (const { schema } of bundledSchema) {
            const schemaLabel: string = '<b>schema</b>'
            const dbName: string = `<blueBright>${(schema.db || 'default').padEnd(stringMaxLength(dbNames))}</blueBright>`
            const fileLabel: string = `<dim>${rel(path)}</dim>`

            context.print.log(
              `${schemaLabel} ${pipe} ${dbName} ${pipe} ${fileLabel}`,
              '<blueBright>◆</blueBright>',
            )
          }

          return bundledSchema
        }

        return false
      })
      .filter(Boolean),
  )

  if (schema.length) {
    return schema[0]
  }

  context.print.log(
    `<b>schema</b> ${pipe} <dim>${context.i18n('methods.bundling.noSchema')}</dim>`,
    '<blueBright>◆</blueBright>',
  )
}
