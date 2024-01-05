import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { GetCommand } from './types.js'

export function hashCmd(cmd: GetCommand): number {
  return hashObjectIgnoreKeyOrder({
    ...cmd,
    cmdId: undefined,
    markerId: undefined,
    nestedCommands: undefined,
    nestedFind: undefined,
    target: undefined,
    noMerge: undefined,
    sourceFieldByPath: undefined,
  })
}
