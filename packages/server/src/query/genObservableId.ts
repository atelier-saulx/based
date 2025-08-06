import { hashObjectIgnoreKeyOrder, hash } from '@based/hash'

export const genObservableId = (name: string, payload: any): number => {
  if (payload === undefined) {
    return hash(name)
  }
  return hashObjectIgnoreKeyOrder([name, payload])
}
