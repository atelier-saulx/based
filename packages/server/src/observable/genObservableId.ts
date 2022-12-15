import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

export const genObservableId = (name: string, payload: any): number => {
  return hashObjectIgnoreKeyOrder([name, payload])
}
