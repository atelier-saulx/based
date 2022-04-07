import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

export const generateSubscriptionId = (payload: any, name?: string): number => {
  return name
    ? hashObjectIgnoreKeyOrder([name, payload])
    : hashObjectIgnoreKeyOrder(payload)
}
