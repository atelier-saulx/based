import { ChannelMessageFunction } from './functions'

export abstract class BasedChannel<K = any> {
  abstract subscribe(onMessage: ChannelMessageFunction<K>): () => void
  abstract publish(message: K): void
}
