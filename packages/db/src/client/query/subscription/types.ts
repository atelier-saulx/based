import { BasedQueryResponse } from '../BasedIterable.js'
import { BasedDbQuery } from '../BasedDbQuery.js'

export type OnData = (res: BasedQueryResponse) => any

export type OnError = (err: Error) => any

export type OnClose = () => BasedDbQuery

export type OnSubscription = (res: any, err?: Error) => void

export type Subscription = {
  query: BasedDbQuery
  subs: Set<OnSubscription>
  res?: BasedQueryResponse
  closed: boolean
  inProgress: boolean // dont need to check
  // filter - realy nice to add
}

export type SubscriptionsMap = Map<number, Subscription>

export type SubscriptionsToRun = Subscription[]

export type SubscriptionMarkers = any

// for fields its very different
// if shceduled need to remove from every field (-1 on each other field)

// later replace this with native + buffer / externalID

// main fields buffer

// counts have to be send upstream in modify buffer

// TODO for later
// handled x/y/z
// type + id

// Buffer[prop]: subs
// Buffer[start]: subs

// OPTION
// IDS
// very simple
// main: { start: subs }, props: { propNr: subs }, all: subs

// FILTER
// very simple
// main: { start: subs }, props: { propNr: subs }, all: subs

export type ModifySubscriptionMap = Map<
  number, // typeID
  {}
>
