import { SelvaClient } from '@saulx/selva'

export default (selvaClient: SelvaClient, type: string): string | void => {
  let idPrefix: string
  if (selvaClient.schemas) {
    for (const db in selvaClient.schemas) {
      const dbSchema = selvaClient.schemas[db]
      if (dbSchema.prefixToTypeMapping) {
        for (const prefix in dbSchema.prefixToTypeMapping) {
          if (dbSchema.prefixToTypeMapping[prefix] === type) {
            idPrefix = prefix
            break
          }
        }
      }
    }
  }
  return idPrefix
}
