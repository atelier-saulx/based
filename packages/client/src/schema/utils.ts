import { BasedSchema } from '@based/schema'

const CHARS = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const MAXTRIES = Math.pow(CHARS.length, 2)
const prefixAlreadyExists = (prefix: string, currentSchema: BasedSchema) =>
  Object.keys(currentSchema.types)
    .map((typeName) => currentSchema.types[typeName].prefix)
    .includes(prefix)

export const generateNewPrefix = (
  typeName: string,
  currentSchema: BasedSchema
) => {
  let newPrefix = typeName.slice(0, 2)

  let counter = 0
  while (prefixAlreadyExists(newPrefix, currentSchema)) {
    if (counter > 0 && counter % CHARS.length) {
      newPrefix =
        CHARS[Math.floor(counter / CHARS.length)] + newPrefix.substring(1)
    }
    newPrefix = newPrefix.substring(0, 1) + CHARS[counter % CHARS.length]
    counter++
    if (counter > MAXTRIES) {
      throw new Error('No more prefixes available')
    }
  }
  return newPrefix
}
