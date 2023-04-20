import { BasedFunctionConfig, isBasedFunctionConfig } from '@based/functions'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'

export const genVersion = (spec: BasedFunctionConfig): number => {
  if (isBasedFunctionConfig('channel', spec)) {
    const { subscriber, publisher, relay } = spec
    if (!subscriber && !publisher && relay) {
      return hash(spec.relay)
    }
    return hashObjectIgnoreKeyOrder({
      subscriber: subscriber ? subscriber.toString() : '',
      publisher: publisher ? publisher.toString() : '',
    })
  } else {
    if (spec.relay) {
      return hash(spec.relay)
    } else {
      const { fn } = spec
      return hash(fn.toString())
    }
  }
}
