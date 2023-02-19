export type ChannelMessageFunction<K = any> = (message: K) => void

// Type of subscriptions
// 5 = subscribe
// 7 = unsubscribe
// 6 = publish

export type ChannelType = 5 | 7

export type ChannelQueue = Map<
  number, // id
  | [
      5,
      string, // name
      any // payload
    ]
  | [
      5,
      string // name
    ]
  // 6 means register channel id
  | [6, string, any]
  | [6, string]
  | [7]
>

export type ChannelPublishQueueItem = [number, any]
export type ChannelPublishQueue = ChannelPublishQueueItem[]

export type ChannelState = Map<
  number,
  {
    payload: any
    name: string
    subscribers: Map<number, ChannelMessageFunction>
  }
>
