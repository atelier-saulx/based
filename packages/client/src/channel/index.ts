import { BasedClient } from '../index.js'
import { genObserveId } from '@based/protocol/client-server'
import {
  addChannelCloseToQueue,
  addChannelPublishIdentifier,
  addChannelSubscribeToQueue,
  addToPublishQueue,
} from '../outgoing/index.js'
import { ChannelMessageFunction } from '../types/index.js'
import { cleanUpChannels } from './cleanUp.js'

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

  subscribe(
    onMessage: ChannelMessageFunction,
    onError?: (err: Error) => void,
  ): () => void {
    let subscriberId: number
    if (
      !this.client.channelState.has(this.id) ||
      this.client.channelState.get(this.id).subscribers.size === 0
    ) {
      subscriberId = 1
      const subscribers = new Map()
      subscribers.set(subscriberId, { onMessage, onError })
      this.client.channelState.set(this.id, {
        payload: this.payload,
        name: this.name,
        subscribers,
        removeTimer: -1,
        idCnt: 1,
      })
      addChannelSubscribeToQueue(this.client, this.name, this.id, this.payload)
    } else {
      const channel = this.client.channelState.get(this.id)
      channel.removeTimer = -1
      subscriberId = ++channel.idCnt
      channel.subscribers.set(subscriberId, { onMessage, onError })
    }

    return () => {
      const channel = this.client.channelState.get(this.id)
      channel.subscribers.delete(subscriberId)
      if (channel.subscribers.size === 0) {
        channel.removeTimer = 2
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
        removeTimer: 2, // 2x 30sec
        idCnt: 0,
      })
      cleanUpChannels(this.client)
      addChannelPublishIdentifier(this.client, this.name, this.id, this.payload)
    } else {
      const channel = this.client.channelState.get(this.id)
      if (channel.removeTimer !== -1 && channel.removeTimer < 2) {
        channel.removeTimer = 2 // 2x 30sec
        cleanUpChannels(this.client)
      }
    }
    addToPublishQueue(this.client, this.id, message)
  }
}
