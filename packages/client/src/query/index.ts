import {
  ObserveDataListener,
  ObserveErrorListener,
  CloseObserve,
} from '../types/index.js'
import {
  addObsToQueue,
  addObsCloseToQueue,
  addGetToQueue,
} from '../outgoing/index.js'
import { genObserveId } from '@based/protocol/client-server'
import { BasedClient } from '../index.js'
import { removeStorage, setStorage } from '../persistentStorage/index.js'
import { freeCacheMemory } from '../cache.js'

// Can extend this as a query builder
// TODO: maybe add user bound as option (will clear / set on a-state chage)
export class BasedClientQuery<P = any, K = any> {
  public id: number
  public query: P
  public name: string
  public client: BasedClient
  public persistent: boolean

  constructor(
    client: BasedClient,
    name: string,
    payload: P,
    opts?: { persistent: boolean },
  ) {
    this.query = payload
    this.id = genObserveId(name, payload)
    this.client = client
    this.name = name
    this.persistent = opts?.persistent || false
  }

  get cache(): any {
    return this.client.cache.get(this.id) || null
  }

  clearCache() {
    if (this.persistent) {
      removeStorage(this.client, '@based-cache-' + this.id)
    }
    this.client.cache.delete(this.id)
  }

  subscribe(
    onData: ObserveDataListener<K>,
    onError?: ObserveErrorListener,
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
        persistent: this.persistent || false,
        idCnt: 1,
      })
      addObsToQueue(
        this.client,
        this.name,
        this.id,
        this.query,
        cachedData?.c || 0,
      )
    } else {
      const obs = this.client.observeState.get(this.id)
      if (this.persistent && !obs.persistent) {
        obs.persistent = true
        if (cachedData) {
          setStorage(this.client, '@based-cache-' + this.id, cachedData)
        }
      }
      subscriberId = ++obs.idCnt
      obs.subscribers.set(subscriberId, {
        onError,
        onData,
      })
    }

    if (cachedData) {
      onData(cachedData.v, cachedData.c)
    }

    return () => {
      const obs = this.client.observeState.get(this.id)
      if (obs) {
        obs.subscribers.delete(subscriberId)
        if (obs.subscribers.size === 0) {
          this.client.observeState.delete(this.id)

          if (this.client.cacheSize > this.client.maxCacheSize) {
            freeCacheMemory(this.client)
          }

          addObsCloseToQueue(this.client, this.id)
        }
      } else {
        console.warn('Subscription allready removed', this.query, this.name)
      }
    }
  }

  async getWhen(
    condition: (data: any, checksum: number) => boolean,
  ): Promise<K> {
    return new Promise((resolve) => {
      const close = this.subscribe((data, checksum) => {
        if (condition(data, checksum)) {
          resolve(data)
          close()
        }
      })
    })
  }

  async get(): Promise<K> {
    return new Promise((resolve, reject) => {
      if (this.client.getState.has(this.id)) {
        this.client.getState.get(this.id).push([resolve, reject])
        return
      }

      const cachedData = this.client.cache.get(this.id)
      if (this.client.observeState.has(this.id)) {
        if (this.client.oQ.has(this.id)) {
          const [type] = this.client.oQ.get(this.id)
          if (type === 1) {
            this.client.getState.set(this.id, [[resolve, reject]])
            return
          }
        }
        if (cachedData) {
          resolve(cachedData.v)
          return
        }
      }

      this.client.getState.set(this.id, [[resolve, reject]])
      addGetToQueue(
        this.client,
        this.name,
        this.id,
        this.query,
        cachedData?.c || 0,
      )
    })
  }
}
