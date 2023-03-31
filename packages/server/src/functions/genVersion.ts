import { BasedFunctionConfig, isBasedFunctionConfig } from '@based/functions'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'

export const genVersion = (spec: BasedFunctionConfig): number => {
  if (isBasedFunctionConfig('channel', spec)) {
    const { subscriber, publisher } = spec
    return hashObjectIgnoreKeyOrder({
      subscriber: subscriber ? subscriber.toString() : '',
      publisher: publisher ? publisher.toString() : '',
    })
  } else {
    const { fn } = spec
    return hash(fn.toString())
  }
}
