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
// 2 = unsubscribe
export type ObserveType = 1 | 2

export type ObserveQueue = Map<
  number, // id
  | [
      1,
      string, // name
      number, // checksum
      GenericObject // payload
    ]
  | [
      1,
      string, // name
      number // checksum
    ]
  | [
      2,
      string // name
    ]
>

// Type of subscriptions
// 3 = get
export type GetObserveQueue = Map<
  number, // id
  | [
      3,
      string, // name
      number, // checksum
      GenericObject // payload
    ]
  | [
      3,
      string, // name
      number // checksum
    ]
>
