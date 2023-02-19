import { BasedClient } from '../'
import { genObserveId } from '../genObserveId'
import { ChannelMessageFunction } from '../types/channel'

export class BasedChannel<P = any, K = any> {
  public id: number
  public channelId: P
  public name: string
  public client: BasedClient

  constructor(client: BasedClient, name: string, payload: P) {
    this.channelId = payload
    this.id = genObserveId(name, payload)
    this.client = client
    this.name = name
  }

  subscribe(onMessage: ChannelMessageFunction<K>): () => void {
    console.log(onMessage)
    return () => {}
  }

  publish(message: K): void {
    console.log(message)
  }
}
