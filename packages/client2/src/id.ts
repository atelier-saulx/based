import { SELVA_NODE_ID_LEN } from './protocol/index.js'

export function sourceId(ids: string[] | string): string {
  if (typeof ids === 'string') {
    return ids.padEnd(SELVA_NODE_ID_LEN, '\0')
  }
  return ids.map((id) => id.padEnd(SELVA_NODE_ID_LEN, '\0')).join('')
}
