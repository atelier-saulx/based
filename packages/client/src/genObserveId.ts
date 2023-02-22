import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'

export const genObserveId = (name: string, payload: any): number => {
  if (payload === undefined) {
    return hash(name)
  }
  return hashObjectIgnoreKeyOrder([name, payload])
}
