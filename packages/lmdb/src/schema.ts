import { BasedDb } from './index.js'

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export const genPrefix = (db: BasedDb): string => {
  const cnt = ++db.schema.prefixCounter
  const prefix = CHARS[cnt % 62] + CHARS[Math.floor(cnt / 62) % 62]
  if (db.schema.prefixToTypeMapping[prefix]) {
    return genPrefix(db)
  }
  return prefix
}
