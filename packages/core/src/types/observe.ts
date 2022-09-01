export type ObserveOpts = {
  localStorage?: boolean
  maxCacheTime?: number
}

export type ObserveDataListener = (data: any, checksum: number) => void

export type ObserveErrorListener = (err: Error) => void

export type CloseObserve = () => void

export type ObserveState = Map<
  number,
  {
    payload: any
    name: string
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

// fix this format dont need an array ay all object makes more sense...
export type ObserveQueue = Map<
  number, // id
  | [
      1,
      string, // name
      number, // checksum
      any // payload
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
      any // payload
    ]
  | [
      3,
      string, // name
      number // checksum
    ]
>
