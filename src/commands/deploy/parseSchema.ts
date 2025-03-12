import type { BundleResult } from '@based/bundle'

export function parseSchema(bundleResult: BundleResult, schema: string) {
  // let schemaParsed: any
  // if (schemaPath) {
  //   context.print.line().intro(context.i18n('methods.schema.loading')).pipe()

  //   schemaParsed = parseSchema(configBundles, schemaPath)
  //   const dbNames = schemaParsed.map(({ db = 'default' }) => db)

  //   for (const { schema } of schemaParsed) {
  //     const schemaLabel: string = '<b>schema</b>'
  //     const pipe: string = '<dim>|</dim>'
  //     const dbName: string = `<blueBright>${(schema.db || 'default').padEnd(stringMaxLength(dbNames))}</blueBright>`
  //     const fileLabel: string = `<dim>${rel(schemaPath)}</dim>`

  //     context.print.log(
  //       `${schemaLabel} ${pipe} ${dbName} ${pipe} ${fileLabel}`,
  //       '<blueBright>◆</blueBright>',
  //     )
  //   }
  // }

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
