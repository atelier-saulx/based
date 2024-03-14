import { BasedDb } from './index.js'

export const genPrefix = (db: BasedDb): string => {
  const cnt = ++db.schema.prefixCounter
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const prefix = chars[cnt % 62] + chars[Math.floor(cnt / 62) % 62]
  if (db.schema.prefixToTypeMapping[prefix]) {
    return genPrefix(db)
  }
  return prefix
}
