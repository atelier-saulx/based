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
  | [7]
>

export type ChannelPublishQueueItem = [string, any, any]
export type ChannelPublishQueue = ChannelPublishQueueItem[]
