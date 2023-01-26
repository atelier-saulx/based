import {
  ObserveDataListener,
  ObserveErrorListener,
  CloseObserve,
} from '../types'
import { addObsToQueue, addObsCloseToQueue, addGetToQueue } from '../outgoing'
import { genObserveId } from '../genObserveId'
import { BasedClient } from '..'

// Can extend this as a query builder

export class BasedQuery {
  public id: number
  public query: any
  public name: string
  public client: BasedClient

  constructor(client: BasedClient, name: string, payload: any) {
    this.query = payload
    this.id = genObserveId(name, payload)
    this.client = client
    this.name = name
  }

  get cache(): any {
    return this.client.cache.get(this.id) || null
  }

  clearCache() {
    this.client.cache.delete(this.id)
  }

  subscribe(
    onData: ObserveDataListener,
    onError?: ObserveErrorListener
  ): CloseObserve {
    let subscriberId: number
    const cachedData = this.client.cache.get(this.id)
    if (!this.client.observeState.has(this.id)) {
      subscriberId = 1
      const subscribers = new Map()
      subscribers.set(subscriberId, {
        onError,
        onData,
      })
      this.client.observeState.set(this.id, {
        payload: this.query,
        name: this.name,
        subscribers,
      })
      addObsToQueue(
        this.client,
        this.name,
        this.id,
        this.query,
        cachedData?.checksum || 0
      )
    } else {
      const obs = this.client.observeState.get(this.id)
      subscriberId = obs.subscribers.size + 1
      obs.subscribers.set(subscriberId, {
        onError,
        onData,
      })
    }

    if (cachedData) {
      onData(cachedData.value, cachedData.checksum)
    }

    return () => {
      const obs = this.client.observeState.get(this.id)
      obs.subscribers.delete(subscriberId)
      if (obs.subscribers.size === 0) {
        this.client.observeState.delete(this.id)
        addObsCloseToQueue(this.client, this.name, this.id)
      }
    }
  }

  async getWhen(
    condition: (data: any, checksum: number) => boolean
  ): Promise<any> {
    return new Promise((resolve) => {
      const close = this.subscribe((data, checksum) => {
        if (condition(data, checksum)) {
          resolve(data)
          close()
        }
      })
    })
  }

  async get(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.client.getState.has(this.id)) {
        this.client.getState.get(this.id).push([resolve, reject])
        return
      }
      this.client.getState.set(this.id, [])
      const cachedData = this.client.cache.get(this.id)
      if (this.client.observeState.has(this.id)) {
        if (this.client.observeQueue.has(this.id)) {
          const [type] = this.client.observeQueue.get(this.id)
          if (type === 1) {
            this.client.getState.get(this.id).push([resolve, reject])
            return
          }
        }
        if (cachedData) {
          resolve(cachedData.value)
          return
        }
      }
      this.client.getState.get(this.id).push([resolve, reject])
      addGetToQueue(
        this.client,
        this.name,
        this.id,
        this.query,
        cachedData?.checksum || 0
      )
    })
  }
}
