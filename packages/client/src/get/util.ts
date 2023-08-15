import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { GetCommand } from './types'

export function hashCmd(cmd: GetCommand): number {
  return hashObjectIgnoreKeyOrder({
    ...cmd,
    nestedCommands: undefined,
    nestedFind: undefined,
  })
}
