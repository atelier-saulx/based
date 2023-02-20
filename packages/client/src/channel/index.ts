import { BasedClient } from '../'
import { genObserveId } from '../genObserveId'
import {
  addChannelCloseToQueue,
  addChannelPublishIdentifier,
  addChannelSubscribeToQueue,
  addToPublishQueue,
} from '../outgoing'
import { ChannelMessageFunction } from '../types/channel'

export class BasedChannel<P = any, K = any> {
  public id: number
  public payload: P
  public name: string
  public client: BasedClient

  constructor(client: BasedClient, name: string, payload: P) {
    this.payload = payload
    this.id = genObserveId(name, payload)
    this.client = client
    this.name = name
  }

  subscribe(onMessage: ChannelMessageFunction): () => void {
    let subscriberId: number
    if (
      !this.client.channelState.has(this.id) ||
      this.client.channelState.get(this.id).subscribers.size === 0
    ) {
      subscriberId = 1
      const subscribers = new Map()
      subscribers.set(subscriberId, onMessage)
      this.client.channelState.set(this.id, {
        payload: this.payload,
        name: this.name,
        subscribers,
      })
      addChannelSubscribeToQueue(this.client, this.name, this.id, this.payload)
    } else {
      const obs = this.client.channelState.get(this.id)
      subscriberId = obs.subscribers.size + 1
      obs.subscribers.set(subscriberId, onMessage)
    }

    return () => {
      const obs = this.client.channelState.get(this.id)
      obs.subscribers.delete(subscriberId)
      if (obs.subscribers.size === 0) {
        addChannelCloseToQueue(this.client, this.id)
      }
    }
  }

  publish(message: K): void {
    if (!this.client.channelState.has(this.id)) {
      // This is a perf optmization to not send payload + name
      this.client.channelState.set(this.id, {
        payload: this.payload,
        name: this.name,
        subscribers: new Map(),
      })
      addChannelPublishIdentifier(this.client, this.name, this.id, this.payload)
    }
    addToPublishQueue(this.client, this.id, message)
  }
}
