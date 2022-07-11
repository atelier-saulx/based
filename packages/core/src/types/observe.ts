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

// allways reply OR wait
export type ObserveType = 0 | 1

export type ObserveQueue = [
  ObserveType,
  string, // name
  number, // checksum
  GenericObject // payload
][]
