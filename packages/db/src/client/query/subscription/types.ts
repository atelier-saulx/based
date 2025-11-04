import { BasedQueryResponse } from '../BasedQueryResponse.js'

export type OnData = (res: BasedQueryResponse) => any

export type OnError = (err: Error) => any

export type OnClose = () => any

export type OnSubscription = (res: any, err?: Error) => void

// export type Subscription = {
//   query: BasedDbQuery
//   subs: Set<OnSubscription>
//   res?: BasedQueryResponse
//   closed: boolean
//   inProgress: boolean // dont need to check
//   // filter - realy nice to add
// }
