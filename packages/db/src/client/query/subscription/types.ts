import { BasedQueryResponse } from '../BasedQueryResponse.js'

export type OnData = (res: BasedQueryResponse) => any

export type OnError = (err: Error) => any

export type OnClose = () => any

export type OnSubscription = (res: any, err?: Error) => void

export enum SubscriptionType {
  multi = 1,
  singleId = 1,
  timeBasedSingleId = 2, // If any time in there just put it as 200ms for now...
  timeBasedMulti = 3,
}
