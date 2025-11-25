import type { BasedError } from '../../errors/index.js'

export type ObserveOpts = {
  localStorage?: boolean
  maxCacheTime?: number
}

export type ObserveDataListener<K = any> = (data: K, checksum: number) => void

export type ObserveErrorListener = (err: BasedError) => void

export type CloseObserve = () => void

export type ObserveState = Map<
  number,
  {
    persistent?: boolean
    payload: any
    name: string
    idCnt: number
    subscribers: Map<
      number,
      {
        onError?: ObserveErrorListener
        onData: ObserveDataListener
      }
    >
  }
>

export type GetState = Map<
  number,
  [(data: any) => void, ObserveErrorListener][]
>

// Type of subscriptions
// 1 = subscribe
// 2 = unsubscribe
export type ObserveType = 1 | 2

export type ObserveQueueItem =
  | [
      1,
      string, // name
      number, // checksum
      any, // payload
    ]
  | [
      1,
      string, // name
      number, // checksum
    ]
  | [2]

// fix this format dont need an array ay all object makes more sense...
export type ObserveQueue = Map<
  number, // id
  ObserveQueueItem
>

// Type of subscriptions
// 3 = get
export type GetObserveQueueItem =
  | [
      3,
      string, // name
      number, // checksum
      any, // payload
    ]
  | [
      3,
      string, // name
      number, // checksum,
    ]

export type GetObserveQueue = Map<
  number, // id
  GetObserveQueueItem
>
