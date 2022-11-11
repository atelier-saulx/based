import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

export default (name: string, payload: any): number => {
  return hashObjectIgnoreKeyOrder([name, payload])
}
