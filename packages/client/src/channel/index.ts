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
  public channelId: P
  public name: string
  public client: BasedClient

  constructor(client: BasedClient, name: string, payload: P) {
    this.channelId = payload
    this.id = genObserveId(name, payload)
    this.client = client
    this.name = name
  }

  subscribe(onMessage: ChannelMessageFunction): () => void {
    let subscriberId: number
    if (!this.client.channelState.has(this.id)) {
      subscriberId = 1
      const subscribers = new Map()
      subscribers.set(subscriberId, onMessage)
      this.client.channelState.set(this.id, {
        payload: this.channelId,
        name: this.name,
        subscribers,
      })

      addChannelSubscribeToQueue(
        this.client,
        this.name,
        this.id,
        this.channelId
      )
    } else {
      const obs = this.client.channelState.get(this.id)
      subscriberId = obs.subscribers.size + 1
      obs.subscribers.set(subscriberId, onMessage)
    }

    return () => {
      const obs = this.client.channelState.get(this.id)
      obs.subscribers.delete(subscriberId)
      if (obs.subscribers.size === 0) {
        // this.client.channelState.delete(this.id) // later
        addChannelCloseToQueue(this.client, this.id)
      }
    }
  }

  publish(message: K): void {
    // perf optmization
    if (!this.client.channelState.has(this.id)) {
      this.client.channelState.set(this.id, {
        payload: this.channelId,
        name: this.name,
        subscribers: new Map(),
        // last publish?
      })
      addChannelPublishIdentifier(
        this.client,
        this.name,
        this.id,
        this.channelId
      )
    }
    addToPublishQueue(this.client, this.id, message)
  }
}
