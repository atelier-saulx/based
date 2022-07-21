import { GenericObject } from './generic'

export type ObserveMetaInfo = {
  id: string
  checksum: number
  name: string
}

export type ObserveOpts = {
  localStorage?: boolean
  maxCacheTime?: number
}

export type ObserveDataListener = (data?: any, opts?: ObserveMetaInfo) => void

export type ObserveErrorListener = (err: Error, opts?: ObserveMetaInfo) => void

export type CloseObserve = (opts?: ObserveMetaInfo) => void

export type ObserveState = {
  [id: string]: {
    cnt: number
    query: GenericObject
    name: string
    subscribers: {
      [cnt: string]: {
        onError?: ObserveErrorListener
        onData: ObserveDataListener
      }
    }
  }
}

// Type of subscriptions
// 1 = subscribe
// 2 = subscribe force reply
// 3 = get from subscription, no subscribe
// 4 = unsubscribe
export type ObserveType = 1 | 2 | 3 | 4

export type ObserveQueue = Map<
  number, // id
  [
    ObserveType,
    string, // name
    number, // checksum
    GenericObject | undefined // payload
  ]
>
