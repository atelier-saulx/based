import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

export const genObserveId = (name: string, payload: any): number => {
  return hashObjectIgnoreKeyOrder([name, payload])
}
