import { BasedQueryResponse } from '../BasedQueryResponse.ts'

export type OnData = (res: BasedQueryResponse) => any

export type OnError = (err: Error) => any

export type OnClose = () => any

export type OnSubscription = (res: any, err?: Error) => void

export const SubscriptionType = {
  fullType: 0,
  singleId: 1,
  timeBasedSingleId: 2, // If any time in there just put it as 200ms for now...
  timeBasedMulti: 3,
} as const
export type SubscriptionType =
  (typeof SubscriptionType)[keyof typeof SubscriptionType]
