import { BasedClient } from '.'

export default (client: BasedClient, type: string): string | void => {
  let idPrefix: string
  if (client.configuration && client.configuration.schema) {
    for (const db in client.configuration.schema) {
      const dbSchema = client.configuration.schema[db]
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
