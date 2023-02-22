import { ChannelMessageFunction } from './functions'

export abstract class BasedChannel<K = any> {
  abstract subscribe(
    onMessage: ChannelMessageFunction<K>,
    onError?: (err: any) => void
  ): () => void

  abstract publish(message: K): void
}
