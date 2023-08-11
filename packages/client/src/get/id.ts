import { protocol } from '..'
import { GetCommand } from './types'

export function sourceId(cmd: GetCommand): string {
  return cmd.source.idList
    ? cmd.source.idList
        .map((id) => id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0'))
        .join('')
    : cmd.source.id.padEnd(protocol.SELVA_NODE_ID_LEN, '\0')
}
